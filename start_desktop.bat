@echo off
setlocal
title Clipper Sidhiq Desktop Launcher

echo ========================================================
echo     CLIPPER SIDHIQ - STANDALONE DESKTOP EDITION
echo ========================================================
echo.
echo [INFO] Zero Python, external server, or terminal commands required.
echo.

set "SCRIPT_DIR=%~dp0"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"
set "EXE_PATH=%FRONTEND_DIR%\dist-desktop\win-unpacked\Clipper Sidhiq.exe"

REM 1. Check if Clipper Sidhiq Desktop is already running
tasklist /FI "IMAGENAME eq Clipper Sidhiq.exe" 2>nul | find /I "Clipper Sidhiq.exe" >nul
if not errorlevel 1 (
    echo [INFO] Clipper Sidhiq Desktop is already running.
    echo [INFO] Restoring focus to the existing window...
    if exist "%EXE_PATH%" (
        start "" "%EXE_PATH%"
    )
    echo [OK] Done. Window focused.
    ping -n 3 127.0.0.1 >nul
    exit /b 0
)

REM 2. Launch the packaged desktop application if executable exists
if exist "%EXE_PATH%" (
    echo [INFO] Launching packaged desktop executable...
    start "" "%EXE_PATH%"
    
    echo [INFO] Verifying desktop window creation...
    ping -n 4 127.0.0.1 >nul
    
    tasklist /FI "IMAGENAME eq Clipper Sidhiq.exe" 2>nul | find /I "Clipper Sidhiq.exe" >nul
    if not errorlevel 1 (
        echo.
        echo ========================================================
        echo   [SUCCESS] Clipper Sidhiq Desktop is Open and Active!
        echo ========================================================
        echo.
        echo [INFO] A standalone desktop application window has opened.
        echo [INFO] NOTE: Do NOT use a web browser or http://127.0.0.1:4174.
        echo [INFO] Use the standalone Clipper Sidhiq window on your screen.
        echo [INFO] All URL downloads and vertical clipping run inside that window.
        echo.
        ping -n 4 127.0.0.1 >nul
        exit /b 0
    ) else (
        echo [WARN] Packaged executable did not remain active.
        echo [INFO] Transitioning to Electron runtime fallback...
    )
)

REM 3. Fallback: Run through local Electron development shell
echo.
echo [INFO] Starting Clipper Sidhiq via local Electron runtime...
cd /d "%FRONTEND_DIR%"
call npm run electron:start

if errorlevel 1 (
    echo.
    echo ========================================================
    echo   [ERROR] Failed to launch Clipper Sidhiq Desktop.
    echo ========================================================
    pause
    exit /b 1
)

exit /b 0
