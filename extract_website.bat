@echo off
REM Quick launcher for Website Extractor
REM Usage: Just double-click this file or drag-and-drop a URL

python website_extractor.py %*

if errorlevel 1 (
    echo.
    echo Press any key to exit...
    pause >nul
)




