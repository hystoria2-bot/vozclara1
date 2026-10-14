@echo off
setlocal
cd /d "%~dp0"
title Voz Clara - servidor local

if not exist "node_modules" (
  echo Preparando Voz Clara por primera vez...
  call npm install
  if errorlevel 1 goto :error
)

echo Iniciando Voz Clara...
echo.
echo IMPORTANTE: deja esta ventana abierta mientras uses la aplicacion.
echo Para cerrar Voz Clara, vuelve aqui y pulsa Ctrl+C.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 1500; Start-Process 'http://127.0.0.1:5173/'"
call "%~dp0node_modules\.bin\vite.cmd"
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo No se pudo iniciar Voz Clara.
echo Comprueba que Node.js esta instalado y vuelve a intentarlo.
pause
exit /b 1
