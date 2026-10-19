@echo off
setlocal
title Clipper Sidhiq - Video Downloader
cd /d "%~dp0"

start "" pythonw "%~dp0downloader_gui.py"
exit /b 0
