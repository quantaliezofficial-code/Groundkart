@echo off
setlocal enabledelayedexpansion
echo ===================================================
echo Starting GroundKart Services...
echo ===================================================

netstat -ano | findstr "LISTENING" | findstr ":8000 " >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 8000 is already in use by another process!
    echo If another server is running, GroundKart backend may fail to start.
)

echo Starting Backend in a new window...
start "GroundKart Backend" cmd /k "cd backend && call venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo Starting Frontend in a new window...
start "GroundKart Frontend" cmd /k "cd frontend && npm run dev"

echo ===================================================
echo Both services have been launched!
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo ===================================================
