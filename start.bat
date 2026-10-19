@echo off
setlocal enabledelayedexpansion
title Clipper Sidhiq — Serverless Web Edition

echo ========================================================
echo     CLIPPER SIDHIQ — SERVERLESS WEB EDITION
echo ========================================================
echo.
echo [INFO] Running in 100%% Serverless Browser Mode.
echo [INFO] No Ollama, no FastAPI, and no cloud GPU required.
echo.

:: 1. Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH.
    pause
    exit /b 1
)

:: 2. Ensure frontend production bundle exists
if not exist "E:\Clipper_Sidhiq\frontend\dist\index.html" (
    echo [INFO] Building production bundle...
    cd /d "E:\Clipper_Sidhiq\frontend"
    call npm run build
    cd /d "E:\Clipper_Sidhiq"
) else (
    echo [OK] Production bundle verified.
)

:: 3. Launch local preview and open browser
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:4173"

echo.
echo ========================================================
echo  Local studio active at: http://localhost:4173
echo  Ready for Vercel deployment via Git or Vercel CLI.
echo  Press Ctrl+C to close.
echo ========================================================
echo.

cd /d "E:\Clipper_Sidhiq\frontend"
npx vite preview --port 4173 --host 127.0.0.1

pause
