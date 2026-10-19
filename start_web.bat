@echo off
setlocal enabledelayedexpansion
title Clipper Sidhiq Launcher

echo ========================================================
echo     CLIPPER SIDHIQ — ULTRA-PREMIUM CLIPPER
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"
set "WEB_PORT=4173"
set "BRIDGE_PORT=4175"
set "TARGET_URL=http://127.0.0.1:%WEB_PORT%"

:: 1. Verify Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is required but was not found in PATH.
    pause
    exit /b 1
)

:: 2. Start Companion Bridge (Port 4175) if not already active
netstat -ano | findstr ":%BRIDGE_PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [OK] Companion Bridge is already running on port %BRIDGE_PORT%.
) else (
    echo [INFO] Starting Companion Bridge on port %BRIDGE_PORT%...
    start /b node "%SCRIPT_DIR%bridge\server.cjs" >nul 2>&1
    ping -n 2 127.0.0.1 >nul
)

:: 3. Ensure frontend production bundle exists
if not exist "%FRONTEND_DIR%\dist\index.html" (
    echo [INFO] Building production bundle...
    cd /d "%FRONTEND_DIR%"
    call npm run build
    cd /d "%SCRIPT_DIR%"
)

:: 4. Start Web Studio (Port 4173) if not already active
netstat -ano | findstr ":%WEB_PORT%" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [OK] Web Studio is already running on port %WEB_PORT%.
) else (
    echo [INFO] Starting Web Studio on port %WEB_PORT%...
    cd /d "%FRONTEND_DIR%"
    start /b npx vite preview --port %WEB_PORT% --host 127.0.0.1 >nul 2>&1
    cd /d "%SCRIPT_DIR%"
)

:: 5. Wait for Web Studio to be ready
echo [INFO] Waiting for application to initialize...
for /l %%i in (1,1,10) do (
    netstat -ano | findstr ":%WEB_PORT%" | findstr "LISTENING" >nul
    if not errorlevel 1 (
        goto launch_browser
    )
    ping -n 2 127.0.0.1 >nul
)

:launch_browser
echo.
echo ========================================================
echo   [READY] Launching Clipper Sidhiq Studio
echo   URL: %TARGET_URL%
echo ========================================================
echo.

start "" "%TARGET_URL%"

echo Application is running. Close this window or press Ctrl+C to terminate.
ping -n 5 127.0.0.1 >nul
exit /b 0
