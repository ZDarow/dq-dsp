#!/bin/bash
# Прошивка + монитор (ESP-IDF)
cd "$(dirname "$0")/dq-dsp-firmware"
idfx build
idfx -p COM8 flash monitor