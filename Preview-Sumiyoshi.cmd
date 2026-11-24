@echo off
setlocal
cd /d "%~dp0"
node scripts\preview-drive-in.cjs --sumiyoshi
if errorlevel 1 pause
