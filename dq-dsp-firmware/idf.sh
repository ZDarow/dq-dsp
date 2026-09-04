#!/bin/bash
# Source ESP-IDF environment and run idf.py commands.
# Usage:
#   ./idf.sh build
#   ./idf.sh flash -p /dev/ttyACM0
#   ./idf.sh flash monitor -p /dev/ttyACM0
#   ./idf.sh menuconfig
#   ./idf.sh            (opens a shell with IDF in PATH)

set -euo pipefail

# Allow overriding IDF path; otherwise fall back to common locations.
if [ -n "${IDF_PATH:-}" ]; then
  :
elif [ -d "$HOME/esp/esp-idf" ]; then
  export IDF_PATH="$HOME/esp/esp-idf"
elif [ -d "$HOME/.espressif/esp-idf" ]; then
  export IDF_PATH="$HOME/.espressif/esp-idf"
fi

if [ -z "${IDF_PATH:-}" ]; then
  echo "ERROR: IDF_PATH is not set and ESP-IDF was not found under \$HOME/esp/esp-idf or \$HOME/.espressif/esp-idf" >&2
  echo "Set IDF_PATH or install ESP-IDF first." >&2
  exit 1
fi

# Prefer the new IDF tools activation script when available.
if [ -f "$HOME/.espressif/tools/activate_idf_v5.5.5.sh" ]; then
  . "$HOME/.espressif/tools/activate_idf_v5.5.5.sh"
elif [ -f "$IDF_PATH/export.sh" ]; then
  . "$IDF_PATH/export.sh"
else
  echo "ERROR: ESP-IDF export script not found in $IDF_PATH" >&2
  exit 1
fi

cd "$(dirname "$0")"

if [ $# -eq 0 ]; then
  echo "ESP-IDF environment ready. idf.py is available."
  echo "  idf.py build"
  echo "  idf.py flash -p /dev/ttyACM0"
  echo "  idf.py flash monitor -p /dev/ttyACM0"
  exec $SHELL
else
  idf.py "$@"
fi
