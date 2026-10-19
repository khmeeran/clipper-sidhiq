@echo off
setlocal enabledelayedexpansion
title Clipper Sidhiq — Local AI Video Clipping Studio

echo ========================================================
echo        CLIPPER SIDHIQ — LOCAL AI VIDEO STUDIO
echo ========================================================
echo.

:: 1. Check Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in system PATH.
    echo Please install Python 3.10+ and re-run.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VER=%%i
echo [OK] Python found: %PYTHON_VER%

:: 2. Check FFmpeg
where ffmpeg >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] FFmpeg is not found in system PATH.
    echo Please ensure ffmpeg is installed and added to PATH.
    pause
    exit /b 1
)
echo [OK] FFmpeg found in PATH.

:: 3. Check Ollama
curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Local Ollama is not responding at http://127.0.0.1:11434.
    echo Attempting to start Ollama or continue in background...
) else (
    echo [OK] Local Ollama service is running.
)

:: 4. Check Frontend build
if not exist "E:\Clipper_Sidhiq\frontend\dist\index.html" (
    echo [INFO] Building frontend production bundle...
    cd /d "E:\Clipper_Sidhiq\frontend"
    call npm run build
    cd /d "E:\Clipper_Sidhiq"
) else (
    echo [OK] Frontend production bundle verified.
)

:: 5. Open browser after short delay in background
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:8080"

:: 6. Launch FastAPI backend
echo.
echo ========================================================
echo  Server starting at: http://127.0.0.1:8080
echo  Press Ctrl+C to stop the local studio.
echo ========================================================
echo.

cd /d "E:\Clipper_Sidhiq\backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --log-level info

pause
