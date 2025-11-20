@echo off
title Python Playground Launcher
color 0A

echo.
echo ========================================
echo    PYTHON PLAYGROUND LAUNCHER
echo ========================================
echo.

REM Check prerequisites
echo [1/5] Checking prerequisites...

python --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERROR] Python not found!
    echo Please install Python 3.9+ from python.org
    pause
    exit /b 1
)
echo   [OK] Python found

node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERROR] Node.js not found!
    echo Please install Node.js 18+ from nodejs.org
    pause
    exit /b 1
)
echo   [OK] Node.js found

REM Check backend setup
echo.
echo [2/5] Checking backend setup...

if not exist backend\.env (
    color 0E
    echo [WARNING] backend\.env not found!
    echo Creating from template...
    copy backend\.env.example backend\.env >nul
    echo.
    echo IMPORTANT: Edit backend\.env and add your GEMINI_API_KEY
    echo Get your key from: https://makersuite.google.com/app/apikey
    echo.
    echo Press any key after adding your API key...
    pause >nul
)

if not exist backend\venv (
    echo   Creating virtual environment...
    cd backend
    python -m venv venv
    cd ..
)
echo   [OK] Backend configured

REM Install backend dependencies
echo.
echo [3/5] Installing backend dependencies...
cd backend
call venv\Scripts\activate
pip install -r requirements.txt --quiet
if errorlevel 1 (
    color 0C
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)
cd ..
echo   [OK] Backend dependencies installed

REM Install frontend dependencies
echo.
echo [4/5] Installing frontend dependencies...
cd frontend
if not exist node_modules (
    echo   This may take a few minutes on first run...
    call npm install
    if errorlevel 1 (
        color 0C
        echo [ERROR] Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
)
cd ..
echo   [OK] Frontend dependencies installed

REM Start servers
echo.
echo [5/5] Starting servers...
echo.
echo ========================================
echo   Starting Backend Server...
echo ========================================
start "Python Playground - Backend" cmd /k "cd backend && venv\Scripts\activate && python main.py"

echo   Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   Starting Frontend Server...
echo ========================================
start "Python Playground - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   PYTHON PLAYGROUND STARTED!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Two terminal windows have opened:
echo   1. Backend Server (Python/FastAPI)
echo   2. Frontend Server (Vite/React)
echo.
echo Wait a few seconds, then open your browser to:
echo   http://localhost:5173
echo.
echo To stop the servers:
echo   Press Ctrl+C in each terminal window
echo.
echo ========================================
echo.

REM Wait a bit then try to open browser
timeout /t 3 /nobreak >nul
echo Opening browser...
start http://localhost:5173

echo.
echo Happy Coding! 🚀
echo.
pause
