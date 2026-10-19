/**
 * Browser-Native Vertical Video Renderer (1080 x 1920 / 9:16)
 * Renders portrait clips in-browser using HTML5 Canvas 2D + WebCodecs / MP4-Muxer / MediaRecorder.
 * Supports blurred-canvas background composition and burned-in high-contrast captions.
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { CandidateClip } from './heuristicIntelligence';
import { BrowserTranscript } from './transcriptionEngine';

export interface RenderResult {
  clipId: string;
  blob: Blob;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  duration: number;
  sizeBytes: number;
}

export interface RenderOptions {
  reframingMode?: 'blur_background' | 'center_crop';
  subtitleStyle?: 'violet_glow' | 'radiant_gold' | 'clean_white';
  marginV?: number;
  onProgress?: (pct: number, message: string) => void;
}

export async function renderVerticalClipInBrowser(
  sourceVideo: HTMLVideoElement,
  clip: CandidateClip,
  transcript?: BrowserTranscript,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const reframingMode = options.reframingMode || 'blur_background';
  const subtitleStyle = options.subtitleStyle || 'violet_glow';
  const marginV = options.marginV || 380;
  const onProgress = options.onProgress;

  const width = 1080;
  const height = 1920;
  const fps = 30;

  onProgress?.(5, `Preparing 1080x1920 canvas for clip '${clip.title}'...`);

  // Create high-res canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;

  // Thumbnail canvas for preview
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 360;
  thumbCanvas.height = 640;
  const thumbCtx = thumbCanvas.getContext('2d')!;

  const startSec = clip.start_time;
  const endSec = clip.end_time;
  const clipDuration = endSec - startSec;
  const totalFrames = Math.max(1, Math.round(clipDuration * fps));

  // Check if WebCodecs VideoEncoder is supported
  const hasWebCodecs = typeof window !== 'undefined' && 'VideoEncoder' in window;

  let finalBlob: Blob;
  let thumbDataUrl = '';

  if (hasWebCodecs) {
    try {
      onProgress?.(15, 'Rendering with hardware-accelerated WebCodecs (H.264)...');
      finalBlob = await renderWithWebCodecs(
        sourceVideo,
        canvas,
        ctx,
        clip,
        transcript,
        reframingMode,
        subtitleStyle,
        marginV,
        thumbCanvas,
        thumbCtx,
        (thumb) => { thumbDataUrl = thumb; },
        onProgress
      );
    } catch (err) {
      console.warn('WebCodecs rendering failed, falling back to MediaRecorder:', err);
      finalBlob = await renderWithMediaRecorder(
        sourceVideo,
        canvas,
        ctx,
        clip,
        transcript,
        reframingMode,
        subtitleStyle,
        marginV,
        thumbCanvas,
        thumbCtx,
        (thumb) => { thumbDataUrl = thumb; },
        onProgress
      );
    }
  } else {
    finalBlob = await renderWithMediaRecorder(
      sourceVideo,
      canvas,
      ctx,
      clip,
      transcript,
      reframingMode,
      subtitleStyle,
      marginV,
      thumbCanvas,
      thumbCtx,
      (thumb) => { thumbDataUrl = thumb; },
      onProgress
    );
  }

  const url = URL.createObjectURL(finalBlob);

  onProgress?.(100, `Rendered vertical MP4 (${(finalBlob.size / (1024 * 1024)).toFixed(1)} MB)`);

  return {
    clipId: clip.id,
    blob: finalBlob,
    url,
    thumbnailUrl: thumbDataUrl || url,
    width,
    height,
    duration: clipDuration,
    sizeBytes: finalBlob.size
  };
}

/**
 * High-Speed WebCodecs + MP4-Muxer Engine
 */
async function renderWithWebCodecs(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  clip: CandidateClip,
  transcript: BrowserTranscript | undefined,
  reframingMode: string,
  subtitleStyle: string,
  marginV: number,
  thumbCanvas: HTMLCanvasElement,
  thumbCtx: CanvasRenderingContext2D,
  setThumb: (url: string) => void,
  onProgress?: (pct: number, msg: string) => void
): Promise<Blob> {
  const width = canvas.width;
  const height = canvas.height;
  const fps = 30;
  const duration = clip.end_time - clip.start_time;
  const totalFrames = Math.round(duration * fps);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height
    },
    fastStart: 'in-memory'
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e)
  });

  // H.264 Baseline/Main profile Level 5.1 (1080p 30fps)
  await encoder.configure({
    codec: 'avc1.4d002a', // Main Profile Level 4.2
    width,
    height,
    bitrate: 4_500_000, // 4.5 Mbps high quality mobile
    framerate: fps
  });

  // Render frames sequentially by seeking
  video.pause();
  let capturedThumb = false;
  const midFrame = Math.floor(totalFrames / 2);

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    const currentTime = clip.start_time + (frameIdx / fps);
    await seekVideo(video, currentTime);

    // Draw composition onto 1080x1920 canvas
    drawVerticalFrame(ctx, video, width, height, reframingMode, currentTime, clip.start_time, transcript, subtitleStyle, marginV);

    // Capture thumbnail at midpoint
    if (frameIdx === midFrame || (!capturedThumb && frameIdx > 5)) {
      thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
      setThumb(thumbCanvas.toDataURL('image/jpeg', 0.85));
      capturedThumb = true;
    }

    const timestampMicros = Math.round((frameIdx / fps) * 1_000_000);
    const keyFrame = frameIdx % 60 === 0;

    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampMicros,
      duration: Math.round(1_000_000 / fps)
    });

    encoder.encode(videoFrame, { keyFrame });
    videoFrame.close();

    if (frameIdx % 10 === 0) {
      const pct = 15 + Math.round((frameIdx / totalFrames) * 75);
      onProgress?.(pct, `Encoding vertical frame ${frameIdx}/${totalFrames} (${Math.round((frameIdx/fps))}s)...`);
      await new Promise(r => setTimeout(r, 0)); // Yield to UI thread
    }
  }

  await encoder.flush();
  muxer.finalize();

  const buffer = (muxer.target as ArrayBufferTarget).buffer;
  return new Blob([buffer], { type: 'video/mp4' });
}

/**
 * MediaRecorder Fallback Engine
 */
async function renderWithMediaRecorder(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  clip: CandidateClip,
  transcript: BrowserTranscript | undefined,
  reframingMode: string,
  subtitleStyle: string,
  marginV: number,
  thumbCanvas: HTMLCanvasElement,
  thumbCtx: CanvasRenderingContext2D,
  setThumb: (url: string) => void,
  onProgress?: (pct: number, msg: string) => void
): Promise<Blob> {
  const stream = canvas.captureStream(30);

  // Capture audio from video if available
  try {
    const audioStream = (video as any).captureStream ? (video as any).captureStream() : null;
    if (audioStream && audioStream.getAudioTracks().length > 0) {
      stream.addTrack(audioStream.getAudioTracks()[0]);
    }
  } catch (_) {}

  // Determine supported MP4 / WebM mimeType
  const mimeTypes = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=h264',
    'video/webm'
  ];
  const chosenMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType: chosenMime,
    videoBitsPerSecond: 4_500_000
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const finishedPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: chosenMime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm' }));
    };
  });

  recorder.start(100);

  // Play video slice in real-time
  video.currentTime = clip.start_time;
  await video.play();

  const duration = clip.end_time - clip.start_time;
  const startTime = Date.now();
  let capturedThumb = false;

  return new Promise((resolve) => {
    const drawLoop = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currTime = video.currentTime;

      drawVerticalFrame(
        ctx,
        video,
        canvas.width,
        canvas.height,
        reframingMode,
        currTime,
        clip.start_time,
        transcript,
        subtitleStyle,
        marginV
      );

      if (!capturedThumb && elapsed > 1.0) {
        thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        setThumb(thumbCanvas.toDataURL('image/jpeg', 0.85));
        capturedThumb = true;
      }

      const pct = 15 + Math.min(80, Math.round((elapsed / duration) * 80));
      onProgress?.(pct, `Rendering vertical canvas (${Math.round(elapsed)}s / ${Math.round(duration)}s)...`);

      if (elapsed < duration && !video.paused && !video.ended) {
        requestAnimationFrame(drawLoop);
      } else {
        video.pause();
        recorder.stop();
        finishedPromise.then(resolve);
      }
    };
    requestAnimationFrame(drawLoop);
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.max(0, time);
  });
}

/**
 * Composite a single vertical 1080x1920 frame
 */
function drawVerticalFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
  mode: string,
  currentTime: number,
  clipStart: number,
  transcript?: BrowserTranscript,
  subtitleStyle: string = 'violet_glow',
  marginV: number = 380
) {
  const vidW = video.videoWidth || 1920;
  const vidH = video.videoHeight || 1080;

  if (mode === 'center_crop') {
    // 9:16 crop from center
    const targetAspect = 9 / 16;
    const currentAspect = vidW / vidH;

    let srcW = vidW;
    let srcH = vidH;
    let srcX = 0;
    let srcY = 0;

    if (currentAspect > targetAspect) {
      srcW = vidH * targetAspect;
      srcX = (vidW - srcW) / 2;
    } else {
      srcH = vidW / targetAspect;
      srcY = (vidH - srcH) / 2;
    }

    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, w, h);
  } else {
    // Default: Blurred background canvas composition
    // 1. Draw blurred, darkened background stretched to fill 1080x1920
    ctx.save();
    ctx.filter = 'blur(35px) brightness(0.65)';
    ctx.drawImage(video, -40, -40, w + 80, h + 80);
    ctx.restore();

    // 2. Draw crisp foreground video centered with aspect ratio preserved
    const scale = w / vidW;
    const fgH = vidH * scale;
    const fgY = (h - fgH) / 2;

    // Drop shadow behind foreground
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(video, 0, fgY, w, fgH);
    ctx.restore();
  }

  // 3. Render synchronized captions inside safe zone
  if (transcript && transcript.segments) {
    const activeSeg = transcript.segments.find(
      s => currentTime >= s.start && currentTime <= s.end
    );

    if (activeSeg) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = 'bold 54px "Plus Jakarta Sans", system-ui, sans-serif';

      const textY = h - marginV;
      const displayText = activeSeg.text.toUpperCase();

      // Determine colors based on style
      let highlightColor = '#c084fc'; // electric violet
      if (subtitleStyle === 'radiant_gold') highlightColor = '#fbbf24';
      if (subtitleStyle === 'clean_white') highlightColor = '#38bdf8';

      // Deep stroke/outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 10;
      ctx.lineJoin = 'round';
      ctx.strokeText(displayText, w / 2, textY);

      // Primary fill
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(displayText, w / 2, textY);

      ctx.restore();
    }
  }
}
