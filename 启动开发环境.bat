@echo off
chcp 65001 >nul
title 小宋编导工作台 - 本地开发
cd /d E:\小宋\腾讯云生产版同步_20260918
powershell -ExecutionPolicy Bypass -File "启动本地开发.ps1"
pause
