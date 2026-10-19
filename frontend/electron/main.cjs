const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync, execSync } = require('child_process');

const logPath = 'E:\\Clipper_Sidhiq\\desktop_startup.log';
function debugLog(msg) {
  try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\r\n`); } catch (_) {}
}

debugLog(`[STARTUP] main.cjs loaded | PID: ${process.pid} | ResourcesPath: ${process.resourcesPath} | AppPath: ${app.getAppPath()}`);

process.on('uncaughtException', (err) => {
  debugLog(`[FATAL] uncaughtException: ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
  debugLog(`[FATAL] unhandledRejection: ${reason}`);
});
process.on('exit', (code) => {
  debugLog(`[EXIT] process.exit called with code: ${code}`);
});
app.on('will-quit', () => {
  debugLog(`[LIFECYCLE] app will-quit event`);
});
app.on('quit', (_event, exitCode) => {
  debugLog(`[LIFECYCLE] app quit event with exitCode: ${exitCode}`);
});
app.on('render-process-gone', (_event, _webContents, details) => {
  debugLog(`[CRASH] render-process-gone: ${JSON.stringify(details)}`);
});
app.on('child-process-gone', (_event, details) => {
  debugLog(`[CRASH] child-process-gone: ${JSON.stringify(details)}`);
});

let mainWindow = null;
const activeDownloads = new Map();

function getBinaryPath(name) {
  // Check development path: frontend/bin/<name>.exe
  const devPath = path.join(__dirname, '..', 'bin', `${name}.exe`);
  if (fs.existsSync(devPath)) return devPath;

  // Check packaged resources path: resources/bin/<name>.exe
  const prodPath = path.join(process.resourcesPath, 'bin', `${name}.exe`);
  if (fs.existsSync(prodPath)) return prodPath;

  // Fallback to local project path if running from repo root
  const repoPath = path.join(__dirname, '..', '..', 'bin', `${name}.exe`);
  if (fs.existsSync(repoPath)) return repoPath;

  return `${name}.exe`;
}

function getSafeDefaultPaths() {
  const baseDownloads = app.getPath('downloads');
  const appDownloadsDir = path.join(baseDownloads, 'ClipperSidhiq_Downloads');
  const appExportsDir = path.join(baseDownloads, 'ClipperSidhiq_Clips');

  if (!fs.existsSync(appDownloadsDir)) {
    fs.mkdirSync(appDownloadsDir, { recursive: true });
  }
  if (!fs.existsSync(appExportsDir)) {
    fs.mkdirSync(appExportsDir, { recursive: true });
  }

  return { appDownloadsDir, appExportsDir };
}

debugLog(`[STARTUP] Requesting single instance lock...`);
const gotTheLock = app.requestSingleInstanceLock();
debugLog(`[STARTUP] gotTheLock result: ${gotTheLock}`);
if (!gotTheLock) {
  debugLog(`[STARTUP] Another instance is already holding the lock. Quitting duplicate instance.`);
  app.quit();
} else {
  app.on('second-instance', () => {
    debugLog(`[EVENT] second-instance triggered, restoring existing window`);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  debugLog(`[WINDOW] createWindow() called`);
  const preloadPath = path.join(__dirname, 'preload.cjs');
  debugLog(`[WINDOW] preloadPath: ${preloadPath} (exists: ${fs.existsSync(preloadPath)})`);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#090a0f',
    title: 'Clipper Sidhiq — Serverless Local Video Clipper',
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false // Keep WebCodecs rendering fast in background
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Focus and show window cleanly once DOM is ready
  mainWindow.once('ready-to-show', () => {
    debugLog(`[WINDOW] ready-to-show event fired, showing window`);
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    debugLog(`[WINDOW ERROR] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    console.error(`[Electron Error] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  // Check if Vite dev server is running or load production dist
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    debugLog(`[WINDOW] Loading dev URL http://localhost:5173`);
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const appPath = app.getAppPath();
    const appIndexPath = path.join(appPath, 'dist', 'index.html');
    const dirnameIndexPath = path.join(__dirname, '..', 'dist', 'index.html');

    debugLog(`[WINDOW] appIndexPath: ${appIndexPath} (exists: ${fs.existsSync(appIndexPath)})`);
    debugLog(`[WINDOW] dirnameIndexPath: ${dirnameIndexPath} (exists: ${fs.existsSync(dirnameIndexPath)})`);

    if (fs.existsSync(appIndexPath)) {
      debugLog(`[WINDOW] Loading file from appIndexPath: ${appIndexPath}`);
      mainWindow.loadFile(appIndexPath);
    } else if (fs.existsSync(dirnameIndexPath)) {
      debugLog(`[WINDOW] Loading file from dirnameIndexPath: ${dirnameIndexPath}`);
      mainWindow.loadFile(dirnameIndexPath);
    } else {
      debugLog(`[WINDOW] Falling back to URL http://127.0.0.1:4173`);
      mainWindow.loadURL('http://127.0.0.1:4173');
    }
  }

  mainWindow.on('closed', () => {
    debugLog(`[WINDOW] mainWindow closed`);
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  debugLog('[LIFECYCLE] window-all-closed event fired');
  // Terminate any running downloads
  for (const [taskId, download] of activeDownloads.entries()) {
    try {
      if (download.process && download.process.pid) {
        execSync(`taskkill /pid ${download.process.pid} /T /F`, { stdio: 'ignore' });
      }
    } catch (_) {}
  }
  activeDownloads.clear();

  if (process.platform !== 'darwin') {
    debugLog('[LIFECYCLE] app.quit() called from window-all-closed');
    app.quit();
  }
});

// IPC: Get Environment
ipcMain.handle('get-environment', async () => {
  const { appDownloadsDir, appExportsDir } = getSafeDefaultPaths();
  const ytDlp = getBinaryPath('yt-dlp');
  const ffmpeg = getBinaryPath('ffmpeg');
  const ffprobe = getBinaryPath('ffprobe');

  return {
    isDesktop: true,
    platform: process.platform,
    downloadsDir: appDownloadsDir,
    exportsDir: appExportsDir,
    binaries: {
      ytDlp: fs.existsSync(ytDlp),
      ffmpeg: fs.existsSync(ffmpeg),
      ffprobe: fs.existsSync(ffprobe),
      paths: { ytDlp, ffmpeg, ffprobe }
    }
  };
});

// IPC: Select Directory Dialog
ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Destination Folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// IPC: Validate Media with bundled ffprobe
ipcMain.handle('validate-media', async (_event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return { valid: false, error: 'File does not exist on disk' };
  }

  const ffprobePath = getBinaryPath('ffprobe');
  if (!fs.existsSync(ffprobePath)) {
    return { valid: false, error: `ffprobe binary not found at ${ffprobePath}` };
  }

  try {
    const probe = spawnSync(
      ffprobePath,
      [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 30000 }
    );

    if (probe.error) {
      return { valid: false, error: probe.error.message };
    }

    if (!probe.stdout || probe.stdout.trim().length === 0) {
      return { valid: false, error: 'ffprobe returned empty output' };
    }

    const data = JSON.parse(probe.stdout);
    const format = data.format || {};
    const streams = data.streams || [];

    const videoStream = streams.find(s => s.codec_type === 'video');
    const audioStream = streams.find(s => s.codec_type === 'audio');

    const duration = parseFloat(format.duration || (videoStream && videoStream.duration) || '0');

    if (!videoStream) {
      return { valid: false, error: 'No video stream found in media file' };
    }

    if (isNaN(duration) || duration <= 0) {
      return { valid: false, error: 'Invalid or zero-length media duration' };
    }

    return {
      valid: true,
      duration,
      formatName: format.format_name,
      bitRate: parseInt(format.bit_rate || '0', 10),
      video: {
        codec: videoStream.codec_name,
        width: videoStream.width,
        height: videoStream.height,
        fps: evalFraction(videoStream.r_frame_rate || videoStream.avg_frame_rate || '30/1')
      },
      audio: audioStream ? {
        codec: audioStream.codec_name,
        channels: audioStream.channels,
        sampleRate: parseInt(audioStream.sample_rate || '44100', 10)
      } : null
    };
  } catch (err) {
    return { valid: false, error: `Failed to inspect media with ffprobe: ${err.message}` };
  }
});

function evalFraction(str) {
  try {
    if (!str || typeof str !== 'string') return 30;
    const parts = str.split('/');
    if (parts.length === 2) {
      const den = parseFloat(parts[1]);
      return den !== 0 ? parseFloat(parts[0]) / den : 30;
    }
    return parseFloat(str) || 30;
  } catch (_) {
    return 30;
  }
}

// IPC: Download Video via yt-dlp sidecar
ipcMain.handle('download-video', async (event, { url, downloadDir }) => {
  const { appDownloadsDir } = getSafeDefaultPaths();
  const targetDir = downloadDir || appDownloadsDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ytDlpPath = getBinaryPath('yt-dlp');
  const ffmpegPath = getBinaryPath('ffmpeg');

  if (!fs.existsSync(ytDlpPath)) {
    return { success: false, error: `Bundled yt-dlp binary missing at: ${ytDlpPath}` };
  }
  if (!fs.existsSync(ffmpegPath)) {
    return { success: false, error: `Bundled ffmpeg binary missing at: ${ffmpegPath}` };
  }

  const taskId = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outputTemplate = path.join(targetDir, '%(title).80s [%(id)s].%(ext)s');

  const args = [
    '--ffmpeg-location', ffmpegPath,
    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--no-colors',
    '--newline',
    '--progress-template', 'download:{"percent":"%(progress._percent_str)s","speed":"%(progress._speed_str)s","eta":"%(progress._eta_str)s","total_bytes":"%(progress.total_bytes|progress.total_bytes_estimate)s","filename":"%(progress.filename)s"}',
    '-o', outputTemplate,
    '--print', 'after_move:filepath',
    url
  ];

  return new Promise((resolve) => {
    let capturedFilePath = null;
    let stderrOutput = '';
    let isCancelled = false;

    // Use spawn with argument array — NEVER string interpolation in shell
    const child = spawn(ytDlpPath, args, {
      shell: false,
      windowsHide: true
    });

    activeDownloads.set(taskId, {
      process: child,
      targetDir,
      taskId,
      cancel: () => {
        isCancelled = true;
        try {
          if (child.pid) {
            execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
          }
        } catch (_) {
          try { child.kill('SIGKILL'); } catch (_) {}
        }
        // Clean up partial files
        cleanupPartFiles(targetDir);
      }
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('download:')) {
          try {
            const jsonPart = trimmed.slice(9);
            const progress = JSON.parse(jsonPart);
            
            let cleanPercent = 0;
            if (progress.percent) {
              cleanPercent = parseFloat(progress.percent.replace('%', '').trim()) || 0;
            }

            event.sender.send('download-progress', {
              taskId,
              percent: cleanPercent,
              speed: progress.speed ? progress.speed.trim() : '',
              eta: progress.eta ? progress.eta.trim() : '',
              totalBytes: progress.total_bytes ? parseInt(progress.total_bytes, 10) : 0,
              filename: progress.filename ? path.basename(progress.filename) : ''
            });
          } catch (_) {}
        } else if (trimmed.startsWith('[download]')) {
          const match = trimmed.match(/\[download\]\s+([\d.]+)%\s+of\s+([^\s]+)(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/);
          if (match) {
            const pct = parseFloat(match[1]) || 0;
            event.sender.send('download-progress', {
              taskId,
              percent: pct,
              speed: match[3] || '',
              eta: match[4] || '',
              totalBytes: 0,
              filename: ''
            });
          }
        } else if (trimmed.endsWith('.mp4') && fs.existsSync(trimmed)) {
          capturedFilePath = trimmed;
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    child.on('close', async (code) => {
      activeDownloads.delete(taskId);

      if (isCancelled) {
        resolve({ success: false, cancelled: true, error: 'Download cancelled by user.' });
        return;
      }

      if (code !== 0) {
        const errMsg = parseYtDlpError(stderrOutput);
        resolve({ success: false, error: errMsg });
        return;
      }

      // If capturedFilePath was not printed, find newest mp4 file in targetDir
      let finalFilePath = capturedFilePath;
      if (!finalFilePath || !fs.existsSync(finalFilePath)) {
        finalFilePath = findNewestMp4(targetDir);
      }

      if (!finalFilePath || !fs.existsSync(finalFilePath)) {
        resolve({ success: false, error: 'Video download completed but output file could not be located.' });
        return;
      }

      // Inspect media with ffprobe before declaring success
      const probeResult = await validateMediaInternal(finalFilePath);
      if (!probeResult.valid) {
        resolve({ success: false, error: `Downloaded media is corrupt or invalid: ${probeResult.error}` });
        return;
      }

      const stats = fs.statSync(finalFilePath);

      resolve({
        success: true,
        taskId,
        filePath: finalFilePath,
        fileName: path.basename(finalFilePath),
        fileSize: stats.size,
        metadata: probeResult
      });
    });

    child.on('error', (err) => {
      activeDownloads.delete(taskId);
      resolve({ success: false, error: `Failed to execute bundled yt-dlp: ${err.message}` });
    });
  });
});

// IPC: Cancel Download
ipcMain.handle('cancel-download', async (_event, taskId) => {
  const item = activeDownloads.get(taskId);
  if (item) {
    item.cancel();
    activeDownloads.delete(taskId);
    return { success: true };
  }
  return { success: false, error: 'No active download found with that taskId' };
});

// IPC: Read Media File bytes as ArrayBuffer for in-memory processing
ipcMain.handle('read-media-file', async (_event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, error: 'File not found on disk' };
  }

  try {
    const buffer = await fs.promises.readFile(filePath);
    return {
      success: true,
      fileName: path.basename(filePath),
      fileSize: buffer.length,
      mimeType: 'video/mp4',
      buffer: buffer.buffer // Sends ArrayBuffer to renderer
    };
  } catch (err) {
    return { success: false, error: `Could not read file: ${err.message}` };
  }
});

// IPC: Save Clip to disk
ipcMain.handle('save-clip', async (_event, { fileName, buffer, folderPath }) => {
  const { appExportsDir } = getSafeDefaultPaths();
  const targetDir = folderPath || appExportsDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
  const fullPath = path.join(targetDir, safeFileName);

  try {
    await fs.promises.writeFile(fullPath, Buffer.from(buffer));
    return { success: true, savedPath: fullPath, folderPath: targetDir };
  } catch (err) {
    return { success: false, error: `Failed to save clip: ${err.message}` };
  }
});

// IPC: Open Folder in Explorer
ipcMain.handle('open-folder', async (_event, targetPath) => {
  if (!targetPath) return { success: false, error: 'Path is required' };

  try {
    if (fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        await shell.openPath(targetPath);
      } else {
        shell.showItemInFolder(targetPath);
      }
      return { success: true };
    } else {
      // Fallback to exports folder
      const { appExportsDir } = getSafeDefaultPaths();
      await shell.openPath(appExportsDir);
      return { success: true };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Helper: ffprobe inspection
function validateMediaInternal(filePath) {
  const ffprobePath = getBinaryPath('ffprobe');
  if (!fs.existsSync(ffprobePath)) {
    return Promise.resolve({ valid: false, error: 'ffprobe binary not found' });
  }

  return new Promise((resolve) => {
    try {
      const probe = spawnSync(
        ffprobePath,
        [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          filePath
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 30000 }
      );

      if (probe.error || !probe.stdout) {
        resolve({ valid: false, error: (probe.error && probe.error.message) || 'Empty ffprobe output' });
        return;
      }

      const data = JSON.parse(probe.stdout);
      const format = data.format || {};
      const streams = data.streams || [];
      const videoStream = streams.find(s => s.codec_type === 'video');
      const audioStream = streams.find(s => s.codec_type === 'audio');
      const duration = parseFloat(format.duration || (videoStream && videoStream.duration) || '0');

      if (!videoStream || isNaN(duration) || duration <= 0) {
        resolve({ valid: false, error: 'Corrupt or unplayable video streams' });
        return;
      }

      resolve({
        valid: true,
        duration,
        formatName: format.format_name,
        video: {
          codec: videoStream.codec_name,
          width: videoStream.width,
          height: videoStream.height
        },
        audio: audioStream ? {
          codec: audioStream.codec_name,
          sampleRate: parseInt(audioStream.sample_rate || '44100', 10)
        } : null
      });
    } catch (e) {
      resolve({ valid: false, error: e.message });
    }
  });
}

function parseYtDlpError(stderr) {
  if (!stderr) return 'Download failed with unknown error.';
  if (stderr.includes('Private video')) return 'The requested video is private.';
  if (stderr.includes('Sign in to confirm your age')) return 'Video requires age verification or sign-in.';
  if (stderr.includes('Video unavailable')) return 'This video is unavailable.';
  if (stderr.includes('DRM')) return 'Video is DRM-protected and cannot be downloaded.';
  if (stderr.includes('HTTP Error 404')) return 'URL returned 404 Not Found.';
  if (stderr.includes('Incomplete YouTube ID')) return 'Invalid YouTube URL or ID.';
  
  // Extract error line
  const lines = stderr.split(/\r?\n/).filter(l => l.includes('ERROR:'));
  if (lines.length > 0) {
    return lines[0].replace('ERROR:', '').trim();
  }
  return stderr.slice(0, 200).trim();
}

function findNewestMp4(dir) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.mp4'))
      .map(f => {
        const full = path.join(dir, f);
        return { path: full, mtime: fs.statSync(full).mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime);

    return files.length > 0 ? files[0].path : null;
  } catch (_) {
    return null;
  }
}

function cleanupPartFiles(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.endsWith('.part') || f.endsWith('.ytdl')) {
        try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
      }
    }
  } catch (_) {}
}
