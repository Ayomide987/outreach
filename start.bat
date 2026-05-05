@echo off
cd /d "%~dp0"
echo.
echo  ==========================================
echo   LeadForge v3 - Starting
echo  ==========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python not found. Get it at python.org
    pause
    exit /b 1
)

if not exist "frontend\dist\index.html" (
    echo  [Building frontend - takes 1-2 min first time...]
    cd frontend
    call npm install --silent
    call npm run build
    cd ..
    echo  Frontend built!
    echo.
)

echo  Open http://localhost:8000 in your browser
echo  Press Ctrl+C to stop.
echo.

cd backend
python main.py

echo.
echo  Server stopped.
pause
