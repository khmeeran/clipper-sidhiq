# Clipper Sidhiq — Vercel-Accessible, Serverless Video Clipping Studio

> **Turn Long Videos Into Moments That Matter.**  
> A 100% serverless, in-browser AI video clipping web application built for Sidhiq. Runs on the user's device from any public Vercel URL — zero Ollama, zero Python servers, zero cloud APIs.

---

## 1. Core Architecture & Highlights

```
                    SIDHIQ — ANY LOCATION
                              │
                              ▼
                   VERCEL-DEPLOYED WEBSITE
                    (React 18 + TypeScript)
                              │
                              ▼
                   BROWSER CLIENT WORKSPACE
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   Auto-Editor          WebCodecs GPU       Heuristic AI
  Silence & Volume     1080x1920 MP4-Muxer   Moment Scoring
  Gating (Web Audio)   Canvas 2D Engine      (Ollama-Free)
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                   ADAPTIVE CLIP SELECTION
                     (No 10-clip quota)
                              │
                              ▼
                     DOWNLOADABLE MP4s
                     & Consolidated ZIP
```

### Key Principles:
1. **Serverless & Host-Free**: Runs entirely in the client's browser. When the developer PC is powered off, the site continues to work flawlessly on Vercel.
2. **Ollama-Free Heuristic Content Intelligence**: Evaluates volume envelope dynamics (hook strength), speech density, natural pause boundaries, and pacing metrics without needing a local or remote LLM.
3. **Auto-Editor Silence & Speech Boundary Gating**: Web Audio API decodes audio samples in-browser to detect speech active intervals and sentence/cadence pauses with 250ms margin smoothing.
4. **Adaptive Selection**: No arbitrary 10-clip quota. Three strong clips are sufficient; twenty or more are supported when justified.
5. **Exact 1080 × 1920 (9:16 Portrait) MP4 Output**:
   - Hardware-accelerated WebCodecs H.264 video encoding via `mp4-muxer`.
   - Blurred canvas composition and direct center crop options.
   - High-contrast animated burned-in captions placed in mobile vertical safe zones.
6. **Zero Video Uploads**: Video files are processed directly in the browser's local sandbox; private footage never leaves the user's device.

---

## 2. Deploying to Vercel

### Option 1: Via GitHub (Recommended)
1. Push this repository to your GitHub account:
   ```bash
   git remote add origin https://github.com/your-username/clipper-sidhiq.git
   git push -u origin master
   ```
2. Open **[vercel.com](https://vercel.com)** and click **Add New Project**.
3. Import the `clipper-sidhiq` repository.
4. Set **Root Directory** to `frontend` (or leave default root, as `vercel.json` is configured).
5. Click **Deploy**. Vercel will build and assign a permanent public URL (e.g. `https://clipper-sidhiq.vercel.app`).

### Option 2: Via Vercel CLI
```bash
cd E:\Clipper_Sidhiq\frontend
npx vercel
```
Follow the interactive CLI prompts to link to your Vercel account and deploy.

---

## 3. Local Preview & Testing

To test the serverless build locally before deploying:
```bash
E:\Clipper_Sidhiq\start.bat
```
Or with terminal:
```bash
cd E:\Clipper_Sidhiq\frontend
npm run build
npx vite preview --port 4173
```
Open **`http://localhost:4173`** in your browser.

---

## 4. Acceptance Criteria Verification

- [x] **Accessible anywhere via Vercel**: 100% static client bundle with SPA rewrite rules in `vercel.json`.
- [x] **Works when dev PC is off**: No local daemon or server required at runtime.
- [x] **No Ollama installation needed**: Replaced with explainable heuristic audio & pacing intelligence.
- [x] **In-browser video processing**: Audio decoding via Web Audio API, volume analysis via Auto-Editor algorithms in JS, and video encoding via WebCodecs & MP4-Muxer.
- [x] **No paid APIs**: Core clipping pipeline operates without OpenAI, Claude, or cloud GPU fees.
- [x] **Adaptive clip selection**: Content determines output (no forced 10-clip quota).
- [x] **Exact 1080×1920 vertical MP4**: Clean H.264/AAC output with download-all ZIP support.
- [x] **Browser memory & privacy**: All processing occurs in-memory and in IndexedDB, with an instant "Clear Cache" button.
