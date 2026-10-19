# Clipper Sidhiq — Ultra-Premium Local AI Video Clipping Studio

> **Turn Long Videos Into Moments That Matter.**  
> A 100% local-first Windows application for intelligent speech transcription, viral moment discovery, 9:16 vertical reframing, and animated subtitle burning. Built for Sidhiq.

---

## 1. Key Principles & Capabilities

1. **100% Host-Isolated (Local-First):** All video processing, Whisper transcription, Ollama LLM inference, and temporary media storage stay entirely on the Windows host. Zero cloud servers, paid APIs, or subscriptions required.
2. **Adaptive Discovery (No Arbitrary Quotas):** Content dictates the number of clips. Three strong moments are better than ten weak ones; twenty or more are supported when justified.
3. **Exact Vertical Specification:** Every generated clip is strictly **1080 × 1920 (9:16 aspect ratio)**, H.264 video, and AAC audio packaged in an MP4 container.
4. **Smart Reframing:**
   - **Blurred Canvas (Recommended):** Scales 16:9 widescreen footage into an aesthetically pleasing blurred and darkened 9:16 vertical canvas with zero horizontal stretching.
   - **Center Crop:** Direct 9:16 optical center crop.
5. **High-Contrast Subtitles:** Stylized ASS subtitles rendered inside the vertical safe zone (avoiding mobile UI interference). Word-level timing synchronized with Whisper.
6. **Automatic 6-Hour Retention:** Temporary source videos, intermediate transcripts, and rendered clips are retained for 6 hours post-completion, then automatically cleaned up to safeguard disk space. Includes an instant "Delete Now" action.
7. **Real Measurable Progress:** Live Server-Sent Events (SSE) update the UI across all stages (`INGESTING` → `TRANSCRIBING` → `ANALYZING` → `SELECTING` → `RENDERING` → `VALIDATING` → `COMPLETED`).
8. **Direct Downloads:** Download individual vertical MP4 files or grab all clips in a single consolidated ZIP archive.

---

## 2. Architecture & Tech Stack

```
Browser UI (React 18 + TypeScript + Vite + Tailwind CSS)
    │
    │ HTTP / Server-Sent Events (SSE)
    ▼
FastAPI Local Backend (Uvicorn @ 127.0.0.1:8080)
    │
    ├── Job Manager & SQLite Database (clipper.db)
    ├── Ingestion & Validation (FFprobe)
    ├── Speech Transcription (Faster-Whisper on NVIDIA RTX 3060 CUDA)
    ├── Content Intelligence (Local Ollama: llama3.2:3b / llama3.1:8b)
    ├── Adaptive Deduplication & Overlap Merging
    ├── Vertical Reframing & ASS Subtitles Filter (FFmpeg 8.0)
    ├── MP4 Spec Validation (1080x1920 H.264/AAC)
    └── 6-Hour Retention Lifecycle Daemon
    │
    ▼
Local Storage (E:\Clipper_Sidhiq\data\jobs\<job_id>\)
```

---

## 3. Quick Start

### Simple 1-Click Startup:
Double-click or run from Command Prompt / PowerShell:
```cmd
E:\Clipper_Sidhiq\start.bat
```
`start.bat` will:
1. Verify Python 3.10+ and dependencies.
2. Verify FFmpeg in system PATH.
3. Verify local Ollama service (`http://127.0.0.1:11434`).
4. Ensure the production frontend bundle is ready.
5. Launch the local backend on `http://127.0.0.1:8080`.
6. Open your default web browser to the studio.

### Manual Command:
```powershell
cd E:\Clipper_Sidhiq\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080
```
Then visit: **`http://127.0.0.1:8080`** in your browser.

---

## 4. Workflow Guide

1. **Upload Video:**
   - Drag & drop any `.mp4`, `.mov`, `.mkv`, or `.webm` file into the upload zone.
   - Preview duration, resolution, and file size immediately.
2. **Configure (Optional):**
   - Choose reframing mode (*Blurred Canvas* or *Center Crop*).
   - Select subtitle theme (*Electric Violet*, *Radiant Gold*, or *Clean White*).
   - Select local Ollama model (e.g. `llama3.2:3b`, `llama3.1:8b`).
3. **Click "Find My Best Clips":**
   - Watch the live progress bar and stage stepper in real time.
4. **Review & Download:**
   - Watch vertical 9:16 previews in the built-in player modal.
   - Review viral scores, hooks, and AI reasoning.
   - Click "Download MP4" for individual clips or "Download All (ZIP)".

---

## 5. Storage & Safety Policy

- Job data is stored in isolated directories: `E:\Clipper_Sidhiq\data\jobs\<job_id>\`.
- Retention expires 6 hours after job completion.
- The background daemon checks for expired jobs every 5 minutes and purges them safely.
- Active downloads are protected: the cleaner never deletes files while a user is downloading.
- Path traversal protection guarantees that only files inside `E:\Clipper_Sidhiq\data\jobs\` can be deleted.

---

## 6. Testing & Verification

An end-to-end integration test is provided in the root directory:
```powershell
python E:\Clipper_Sidhiq\test_pipeline_e2e.py
```
This script exercises:
- SAPI human speech synthesis + 1080p video creation
- FFprobe metadata extraction & thumbnail generation
- Faster-Whisper GPU transcription with word timestamps
- Ollama viral candidate scoring & deduplication
- 1080x1920 vertical video rendering with burned ASS captions
- Full MP4 spec validation & ZIP packaging
