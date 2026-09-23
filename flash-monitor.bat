@echo off
REM Прошивка + монитор (ESP-IDF)
cd /d "%~dp0\dq-dsp-firmware"
idfx build
idfx -p COM8 flash monitor