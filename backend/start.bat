@echo off
echo Starting Python Playground Backend...
echo.

REM .env check removed for local dev without AI


REM Check if virtual environment exists
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate

REM Install/upgrade dependencies
echo Installing dependencies...
pip install -r requirements.txt --quiet

echo.
echo ========================================
echo Backend starting on http://localhost:8000
echo Press Ctrl+C to stop
echo ========================================
echo.

REM Start the server
python main.py
