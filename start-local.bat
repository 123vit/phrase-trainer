@echo off
rem Starts the trainer locally and opens it in the browser. Close this window to stop it.
cd /d "%~dp0"
start "" http://127.0.0.1:8765/
python -m http.server 8765 --bind 127.0.0.1
