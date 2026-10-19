"""
Clipper Sidhiq — Simple Native Video Downloader
Standalone, fast, lightweight desktop tool. No web servers, no port conflicts.
"""

import sys
import os
import re
import subprocess
import threading
import tkinter as tk
from tkinter import ttk, messagebox

# Resolve paths
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BIN_DIR = os.path.join(ROOT_DIR, 'frontend', 'bin')
YTDLP_BIN = os.path.join(BIN_DIR, 'yt-dlp.exe')
FFMPEG_BIN = os.path.join(BIN_DIR, 'ffmpeg.exe')
DOWNLOADS_DIR = os.path.join(ROOT_DIR, 'downloads')

os.makedirs(DOWNLOADS_DIR, exist_ok=True)

class SimpleDownloaderApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Clipper Sidhiq — Video Downloader")
        self.root.geometry("680x420")
        self.root.resizable(False, False)
        self.root.configure(bg="#0c0e14")

        self.is_downloading = False
        self.current_process = None

        self.setup_ui()

    def setup_ui(self):
        # Header Frame
        header = tk.Frame(self.root, bg="#0c0e14")
        header.pack(fill="x", padx=24, pady=(20, 10))

        title = tk.Label(
            header,
            text="CLIPPER SIDHIQ",
            font=("Segoe UI", 16, "bold"),
            fg="#a855f7",
            bg="#0c0e14"
        )
        title.pack(anchor="w")

        subtitle = tk.Label(
            header,
            text="Simple One-Click Video Downloader • YouTube, Reels, Shorts, TikTok, X",
            font=("Segoe UI", 9),
            fg="#94a3b8",
            bg="#0c0e14"
        )
        subtitle.pack(anchor="w", pady=(2, 0))

        # Main Card
        card = tk.Frame(self.root, bg="#13151f", bd=1, relief="solid", highlightbackground="#27273a", highlightthickness=1)
        card.pack(fill="both", expand=True, padx=24, pady=10)

        # URL Label & Input
        lbl_url = tk.Label(
            card,
            text="Paste Video Link:",
            font=("Segoe UI", 10, "bold"),
            fg="#e2e8f0",
            bg="#13151f"
        )
        lbl_url.pack(anchor="w", padx=20, pady=(16, 6))

        input_frame = tk.Frame(card, bg="#13151f")
        input_frame.pack(fill="x", padx=20)

        self.url_var = tk.StringVar()
        self.entry_url = tk.Entry(
            input_frame,
            textvariable=self.url_var,
            font=("Segoe UI", 11),
            bg="#1c1f2e",
            fg="#ffffff",
            insertbackground="#ffffff",
            bd=0,
            relief="flat",
            highlightthickness=1,
            highlightbackground="#3b3f58",
            highlightcolor="#a855f7"
        )
        self.entry_url.pack(side="left", fill="x", expand=True, ipady=7, padx=(0, 8))

        btn_paste = tk.Button(
            input_frame,
            text="📋 Paste",
            font=("Segoe UI", 9, "bold"),
            bg="#272a3d",
            fg="#c084fc",
            activebackground="#3b3f58",
            activeforeground="#ffffff",
            bd=0,
            cursor="hand2",
            padx=12,
            pady=6,
            command=self.paste_clipboard
        )
        btn_paste.pack(side="right")

        # Action Buttons
        btn_frame = tk.Frame(card, bg="#13151f")
        btn_frame.pack(fill="x", padx=20, pady=(16, 12))

        self.btn_download = tk.Button(
            btn_frame,
            text="⬇  Download Video",
            font=("Segoe UI", 11, "bold"),
            bg="#9333ea",
            fg="#ffffff",
            activebackground="#7e22ce",
            activeforeground="#ffffff",
            bd=0,
            cursor="hand2",
            padx=20,
            pady=8,
            command=self.start_download
        )
        self.btn_download.pack(side="left")

        self.btn_open_folder = tk.Button(
            btn_frame,
            text="📁 Open Downloads Folder",
            font=("Segoe UI", 10),
            bg="#1c1f2e",
            fg="#94a3b8",
            activebackground="#272a3d",
            activeforeground="#ffffff",
            bd=0,
            cursor="hand2",
            padx=14,
            pady=8,
            command=self.open_downloads_folder
        )
        self.btn_open_folder.pack(side="left", padx=10)

        # Progress Section
        progress_frame = tk.Frame(card, bg="#13151f")
        progress_frame.pack(fill="x", padx=20, pady=(10, 16))

        self.status_label = tk.Label(
            progress_frame,
            text="Ready. Paste a link and click Download Video.",
            font=("Segoe UI", 9),
            fg="#94a3b8",
            bg="#13151f"
        )
        self.status_label.pack(anchor="w", pady=(0, 6))

        # Progress Bar style
        style = ttk.Style()
        style.theme_use('default')
        style.configure("Purple.Horizontal.TProgressbar",
            thickness=10,
            troughcolor="#1c1f2e",
            background="#a855f7"
        )

        self.progress_bar = ttk.Progressbar(
            progress_frame,
            style="Purple.Horizontal.TProgressbar",
            orient="horizontal",
            mode="determinate"
        )
        self.progress_bar.pack(fill="x")

        # Footer
        footer = tk.Frame(self.root, bg="#0c0e14")
        footer.pack(fill="x", padx=24, pady=(0, 10))

        lbl_dest = tk.Label(
            footer,
            text=f"Save Location: {DOWNLOADS_DIR}",
            font=("Segoe UI", 8),
            fg="#64748b",
            bg="#0c0e14"
        )
        lbl_dest.pack(anchor="w")

    def paste_clipboard(self):
        try:
            clipboard = self.root.clipboard_get()
            if clipboard:
                self.url_var.set(clipboard.strip())
        except Exception:
            pass

    def open_downloads_folder(self):
        try:
            os.startfile(DOWNLOADS_DIR)
        except Exception:
            subprocess.Popen(['explorer', DOWNLOADS_DIR])

    def set_status(self, text, fg="#94a3b8"):
        self.status_label.config(text=text, fg=fg)

    def start_download(self):
        url = self.url_var.get().strip()
        if not url:
            messagebox.showwarning("URL Missing", "Please paste a video URL first.")
            return

        if self.is_downloading:
            return

        self.is_downloading = True
        self.btn_download.config(state="disabled", text="⏳ Downloading...")
        self.progress_bar['value'] = 0
        self.set_status("Fetching video stream and metadata...", fg="#c084fc")

        threading.Thread(target=self._run_download, args=(url,), daemon=True).start()

    def _run_download(self, url):
        cmd = [
            YTDLP_BIN if os.path.exists(YTDLP_BIN) else "yt-dlp",
            "--ffmpeg-location", FFMPEG_BIN if os.path.exists(FFMPEG_BIN) else "ffmpeg",
            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "--merge-output-format", "mp4",
            "--newline",
            "--no-mtime",
            "-o", os.path.join(DOWNLOADS_DIR, "%(title)s.%(ext)s"),
            url
        ]

        try:
            self.current_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )

            percent_re = re.compile(r'\[download\]\s+(\d+(?:\.\d+)?)%')
            speed_re = re.compile(r'at\s+([^\s]+)\s+ETA\s+([^\s]+)')

            last_pct = 0
            for line in iter(self.current_process.stdout.readline, ''):
                if not line:
                    break

                clean_line = line.strip()

                pct_match = percent_re.search(clean_line)
                if pct_match:
                    pct = float(pct_match.group(1))
                    last_pct = pct
                    speed_match = speed_re.search(clean_line)
                    extra = f" ({speed_match.group(1)} ETA {speed_match.group(2)})" if speed_match else ""
                    self.root.after(0, self._update_progress, pct, f"Downloading: {pct:.1f}%{extra}")

                elif "[Merger]" in clean_line or "Merging" in clean_line:
                    self.root.after(0, self._update_progress, 95, "Merging audio and video tracks into MP4...")
                elif "[ExtractAudio]" in clean_line:
                    self.root.after(0, self._update_progress, 90, "Extracting audio track...")

            self.current_process.stdout.close()
            ret_code = self.current_process.wait()

            if ret_code == 0:
                self.root.after(0, self._on_download_complete, True, "Download Complete! Video saved to downloads folder.")
            else:
                self.root.after(0, self._on_download_complete, False, "Download failed. Check the URL or network.")

        except Exception as e:
            self.root.after(0, self._on_download_complete, False, f"Error: {str(e)}")

    def _update_progress(self, pct, status_text):
        self.progress_bar['value'] = pct
        self.set_status(status_text, fg="#c084fc")

    def _on_download_complete(self, success, message):
        self.is_downloading = False
        self.btn_download.config(state="normal", text="⬇  Download Video")

        if success:
            self.progress_bar['value'] = 100
            self.set_status(message, fg="#4ade80")
            # Open folder automatically
            self.open_downloads_folder()
        else:
            self.progress_bar['value'] = 0
            self.set_status(message, fg="#f87171")
            messagebox.showerror("Download Error", message)

def main():
    root = tk.Tk()
    app = SimpleDownloaderApp(root)
    root.mainloop()

if __name__ == '__main__':
    main()
