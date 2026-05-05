@echo off
cd /d "%~dp0"
echo.
echo  ==========================================
echo   LeadForge v3 - Fix and Setup
echo  ==========================================
echo.

echo  Installing Python packages...
pip install requests beautifulsoup4 --quiet
echo  Done.
echo.

echo  Building frontend...
cd frontend
call npm install
call npm run build
cd ..
echo.

if exist "frontend\dist\index.html" (
    echo  ==========================================
    echo   Success! Run start.bat to launch.
    echo  ==========================================
) else (
    echo  Frontend build failed. See errors above.
)
echo.
pause
