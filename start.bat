@echo off
setlocal
if /i "%~1"=="--database-only" goto database
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0start-local.ps1" %*
goto done
:database
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0start-local.ps1" -DatabaseOnly
:done
set "result=%errorlevel%"
if not "%result%"=="0" pause
exit /b %result%
