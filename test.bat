@echo off
cd /d "%~dp0"
echo.
echo  ==========================================
echo   LeadForge v3 - Quick Test
echo  ==========================================
python --version
python -c "import requests; print('  requests OK')" 2>nul || echo   requests - run fix.bat
python -c "import bs4; print('  beautifulsoup4 OK')" 2>nul || echo   beautifulsoup4 - run fix.bat
python -c "import main; print('  backend OK')" 2>nul || (cd backend && python -c "import main; print('  backend OK')" 2>&1 && cd ..)
if exist "frontend\dist\index.html" (echo   frontend OK) else (echo   frontend MISSING - run fix.bat)
echo.
pause
