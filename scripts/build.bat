@echo off
echo === watersource-archive Build Script ===
cd /d "%~dp0.."

echo [1/3] Vite build...
call node node_modules/vite/bin/vite.js build
if %errorlevel% neq 0 (
    echo BUILD FAILED!
    exit /b 1
)

echo [2/3] Remove crossorigin attributes...
powershell -Command "(Get-Content dist/index.html) -replace ' crossorigin', '' | Set-Content dist/index.html"

echo [3/3] Build complete!
echo.
echo Serving at: http://localhost:50770
echo To start server: python -m http.server --directory dist 50770
echo.
for %%f in (dist\assets\*.js) do echo JS: %%~nxf (%%~zf bytes)
for %%f in (dist\assets\*.css) do echo CSS: %%~nxf (%%~zf bytes)
