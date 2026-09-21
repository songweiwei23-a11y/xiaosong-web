@echo off
rem 本文件必须保存为 GBK(ANSI) 编码。
rem 早期版本是 UTF-8 无 BOM 并在第二行 chcp 65001，cmd 逐行读取时
rem 切换代码页会导致后续行的字节偏移错乱，中文路径被撕碎，cd 与
rem powershell 调用全部失败(报 '?? is not recognized as ...')。
title 小宋编导工作台 - 本地开发
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0启动本地开发.ps1"
