@echo off
echo =============================================
echo    ??  MCP 天气出行智能助手
echo    一键启动：自动开后端 + 自动开网页
echo =============================================
echo.

echo 正在启动 Python 后端服务...
start "后端服务" python backend.py

timeout /t 2 /nobreak >nul

echo 正在打开前端页面...
start index.html

echo.
echo ? 启动完成！可以开始使用啦～
echo.
pause
