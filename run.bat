@echo off
setlocal enabledelayedexpansion

echo === Lab Performance Analysis ===
echo.

REM Set project root and environment paths
set "PROJECT_ROOT=%~dp0"
set "ENV_DIR=%PROJECT_ROOT%env"
set "APP_DIR=%PROJECT_ROOT%student-viz"

REM Check if conda is installed
call conda --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Conda not found. Checking for Node.js...
    call node --version >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo Neither Conda nor Node.js is installed.
        echo Please install either:
        echo - Conda: https://docs.conda.io/en/latest/miniconda.html
        echo - Node.js: https://nodejs.org/
        echo.
        pause
        exit /b 1
    ) else (
        echo Found Node.js installation. Will use system Node.js.
        goto RUN_APP
    )
) else (
    echo Found Conda installation.
)

REM Check if environment exists
if not exist "%ENV_DIR%" (
    echo Creating local Conda environment in: %ENV_DIR%
    call conda create --prefix "%ENV_DIR%" python=3.9 nodejs=18 -y
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to create Conda environment.
        pause
        exit /b 1
    )
    echo Environment created successfully.
) else (
    echo Found existing environment.
)

REM Activate environment
call conda activate "%ENV_DIR%"
if %ERRORLEVEL% NEQ 0 (
    echo Failed to activate Conda environment.
    pause
    exit /b 1
)

REM Check if the app directory exists
if not exist "%APP_DIR%" (
    echo Creating React app...
    cd "%PROJECT_ROOT%"
    call npx create-react-app student-viz
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to create React app.
        pause
        exit /b 1
    )
)

:RUN_APP
REM Install dependencies if needed
cd "%APP_DIR%"
if not exist "%APP_DIR%\node_modules" (
    echo Installing Node dependencies...
    call npm install recharts xlsx
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

REM Check if public folder contains the Excel file
if not exist "%APP_DIR%\public\Student.xlsx" (
    echo Copying Student.xlsx to public folder...
    if exist "%PROJECT_ROOT%Student.xlsx" (
        if not exist "%APP_DIR%\public" mkdir "%APP_DIR%\public"
        copy "%PROJECT_ROOT%Student.xlsx" "%APP_DIR%\public\"
    ) else (
        echo Warning: Student.xlsx not found. Please place the file in:
        echo %APP_DIR%\public\
        echo or in %PROJECT_ROOT%
    )
)

REM Start the React app
echo.
echo Starting React application...
echo.
echo Note: Browser should open automatically. If not, go to:
echo http://localhost:3000
echo.
echo Press Ctrl+C to stop the server when done.
echo.
call npm start

endlocal