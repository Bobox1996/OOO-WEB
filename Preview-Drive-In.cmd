@echo off
setlocal
cd /d "%~dp0"
node scripts\preview-drive-in.cjs
if errorlevel 1 pause
