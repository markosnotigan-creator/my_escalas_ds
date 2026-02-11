@echo off
echo ========================================
echo   INSTALACAO E EXECUCAO DO PROJETO
echo ========================================
echo.

cd /d "C:\Users\marco\OneDrive\Área de Trabalho\PROJETOS TI\PROJETO ABERTO"

echo [1/2] Instalando dependencias...
echo.
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERRO: Falha na instalacao das dependencias!
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================
echo.
echo [2/2] Iniciando servidor de desenvolvimento...
echo.
echo O projeto estara disponivel em: nao abre
echo.
echo Pressione Ctrl+C para parar o servidor
echo.

call npm run dev

pause
