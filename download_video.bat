@echo off
setlocal
title Clipper Sidhiq - Video Downloader
color 0b

set "BIN_DIR=%~dp0frontend\bin"
set "YTDLP=%BIN_DIR%\yt-dlp.exe"
set "FFMPEG=%BIN_DIR%\ffmpeg.exe"
set "OUT_DIR=%~dp0downloads"

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

:loop
cls
echo ============================================================
echo           CLIPPER SIDHIQ - VIDEO DOWNLOADER
echo ============================================================
echo  Paste any video URL (YouTube, Shorts, Reels, TikTok, etc.)
echo  Saved to: %OUT_DIR%
echo ============================================================
echo.
set "VIDEO_URL="
set /p VIDEO_URL="Paste Video URL (or press Enter to exit): "

if "%VIDEO_URL%"=="" goto done

echo.
echo [INFO] Fetching and downloading video...
echo ------------------------------------------------------------
"%YTDLP%" --ffmpeg-location "%FFMPEG%" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 --no-mtime -o "%OUT_DIR%\%%(title)s.%%(ext)s" "%VIDEO_URL%"

if errorlevel 1 (
    echo.
    echo [ERROR] Download failed. Please verify the URL.
) else (
    echo.
    echo ============================================================
    echo [SUCCESS] Download Complete!
    echo Saved to: %OUT_DIR%
    echo ============================================================
    explorer "%OUT_DIR%"
)

echo.
echo Press any key to download another video, or close window...
pause >nul
goto loop

:done
exit /b 0
