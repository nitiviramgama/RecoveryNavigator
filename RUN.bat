@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title RecoveryNav Assistant

set "APP_PORT=3000"
set "NODE_MIN_MAJOR=20"

if not exist "package.json" (
    echo.
    echo ERROR: package.json not found.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Node.js is not installed.
    echo Install Node.js 20.19+ and run this file again.
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%A in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%A"
if %NODE_MAJOR% LSS %NODE_MIN_MAJOR% (
    echo.
    echo ERROR: Node.js %NODE_MIN_MAJOR%+ is required.
    echo Current version:
    node -v
    pause
    exit /b 1
)

echo.
echo ==========================================
echo        RecoveryNav Assistant
echo ==========================================
echo.

if not exist "node_modules\vite" if exist "node_modules" rmdir /s /q "node_modules"
if not exist "node_modules\tsx" if exist "node_modules" rmdir /s /q "node_modules"

if not exist "node_modules\vite" (
    echo First run: installing dependencies...
    echo.
    call npm install --legacy-peer-deps --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo Dependency installation failed.
        echo Please run this file again after checking your internet connection.
        pause
        exit /b 1
    )
)

set "NODE_ENV=development"
set "PORT=%APP_PORT%"

echo.
echo Starting RecoveryNav...
echo Open: http://localhost:%APP_PORT%
echo Keep this window open while using the app.
echo.

start "" cmd /c "timeout /t 2 /nobreak ^>nul ^& start http://localhost:%APP_PORT%"
call npm run dev

pause
