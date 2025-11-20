@echo off
echo Starting Python Playground Frontend...
echo.

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo.
echo ========================================
echo Frontend starting on http://localhost:5173
echo Press Ctrl+C to stop
echo ========================================
echo.

REM Start the dev server
call npm run dev
