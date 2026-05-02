#!/bin/bash
# Source ESP-IDF environment and run idf.py commands.
# Usage:
#   ./idf.sh build
#   ./idf.sh flash -p /dev/cu.usbserial-0001
#   ./idf.sh flash monitor -p /dev/cu.usbserial-0001
#   ./idf.sh menuconfig
#   ./idf.sh            (opens a shell with IDF in PATH)

export IDF_PATH=/Users/duongtam/Workspace/audio/ESP32_Bluetooth_DSP_Speaker/esp-idf
export ESP_ROM_ELF_DIR=/Users/duongtam/.espressif/tools/esp-rom-elfs/20230320/
export IDF_PYTHON_ENV_PATH=/Users/duongtam/.espressif/python_env/idf5.2_py3.14_env

# Add toolchain and IDF tools to PATH
export PATH="/Users/duongtam/.espressif/tools/xtensa-esp-elf/esp-13.2.0_20230928/xtensa-esp-elf/bin:$IDF_PYTHON_ENV_PATH/bin:$IDF_PATH/tools:$PATH"

# Add any other espressif tool dirs
for d in /Users/duongtam/.espressif/tools/*/; do
    for sd in "$d"*/*/bin; do
        [ -d "$sd" ] && export PATH="$sd:$PATH"
    done
done

cd "$(dirname "$0")"

if [ $# -eq 0 ]; then
    echo "ESP-IDF environment ready. idf.py is available."
    echo "  idf.py build"
    echo "  idf.py flash -p /dev/cu.usbserial-XXXX"
    echo "  idf.py flash monitor -p /dev/cu.usbserial-XXXX"
    exec $SHELL
else
    idf.py "$@"
fi
