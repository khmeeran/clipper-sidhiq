"""
Local YouTube Fetcher Companion for Clipper Sidhiq
Downloads YouTube videos to local disk as genuine MP4 files for processing in Clipper Sidhiq.
"""
import sys
import os
import argparse

def download_youtube_video(url: str, output_dir: str = 'downloads') -> str:
    try:
        import yt_dlp
    except ImportError:
        print("[ERROR] yt-dlp is not installed in the current environment.")
        print("Please run: pip install yt-dlp")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    out_tmpl = os.path.join(output_dir, '%(title).100s_%(id)s.%(ext)s')

    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': out_tmpl,
        'merge_output_format': 'mp4',
        'quiet': False,
        'no_warnings': False,
    }

    print(f"\n[INFO] Initializing YouTube stream retrieval for: {url}")
    print("[INFO] Fetching metadata and downloading stream...")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        base, _ = os.path.splitext(filename)
        final_mp4 = f"{base}.mp4"
        if not os.path.exists(final_mp4) and os.path.exists(filename):
            final_mp4 = filename

    print(f"\n[SUCCESS] Video downloaded successfully to local disk:")
    print(f"  Path: {os.path.abspath(final_mp4)}")
    print(f"  Size: {os.path.getsize(final_mp4) / (1024*1024):.2f} MB")
    print(f"\n-> You can now drag and drop this file directly into Clipper Sidhiq at http://localhost:4173\n")
    return final_mp4

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Fetch YouTube video locally for Clipper Sidhiq")
    parser.add_argument("url", help="YouTube video or shorts URL")
    parser.add_argument("--outdir", default="downloads", help="Directory to save downloaded MP4")
    args = parser.parse_args()

    download_youtube_video(args.url, args.outdir)
