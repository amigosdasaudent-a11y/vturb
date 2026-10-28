@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Abrindo o vêTurb
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org/ e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm nao encontrado. Reinstale o Node.js LTS marcando a opcao para adicionar ao PATH.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Preparando o projeto pela primeira vez. Aguarde a instalacao das dependencias...
  call npm install
  if errorlevel 1 (
    echo.
    echo A instalacao falhou. Confira sua conexao com a internet e tente novamente.
    pause
    exit /b 1
  )
)

echo.
echo O vêTurb sera aberto em http://localhost:5173
echo Para fechar o programa, volte a esta janela e pressione Ctrl+C.
start "" cmd /c "timeout /t 4 /nobreak ^>nul ^& start http://localhost:5173"
call npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
pause
