# dq-dsp-firmware/idf.ps1
# Windows PowerShell wrapper for ESP-IDF idf.py.
# Mirrors the Unix ./idf.sh so the workflow is identical across OSes.
#
# Usage:
#   .\idf.ps1 build
#   .\idf.ps1 flash -p COM14
#   .\idf.ps1 flash monitor -p COM14
#   .\idf.ps1 menuconfig
#   .\idf.ps1            (prints hint, runs idf.py with no args)
#
# Requires: ESP-IDF 5.5.5 (or matching version) installed locally.

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$IdfArgs
)

$ErrorActionPreference = 'Stop'

# Locate IDF_PATH if not set.
if (-not $env:IDF_PATH) {
    $candidates = @(
        "$HOME\esp\esp-idf",
        "$HOME\.espressif\esp-idf",
        "C:\esp\esp-idf",
        "C:\Espressif\frameworks\esp-idf-v5.5.5"
    )
    foreach ($p in $candidates) {
        if (Test-Path -LiteralPath $p) {
            $env:IDF_PATH = (Resolve-Path -LiteralPath $p).Path
            break
        }
    }
}

if (-not $env:IDF_PATH) {
    Write-Error "IDF_PATH is not set and ESP-IDF was not found in any of:`n  $($candidates -join "`n  ")`nSet `$env:IDF_PATH or install ESP-IDF first."
}

# Source the IDF environment. Two flavours: legacy export.ps1 and the
# newer activate_idf_vX.Y.Z.ps1 helper from the tools installer.
$activated = $false
$activate = Join-Path $env:USERPROFILE ".espressif\tools\activate_idf_v5.5.5.ps1"
if (Test-Path -LiteralPath $activate) {
    . $activate
    $activated = $true
} else {
    $export = Join-Path $env:IDF_PATH "export.ps1"
    if (Test-Path -LiteralPath $export) {
        . $export
        $activated = $true
    }
}

if (-not $activated) {
    Write-Error "ESP-IDF activation script not found (looked for $activate and $export)"
}

Set-Location -LiteralPath $PSScriptRoot

if ($IdfArgs.Count -eq 0) {
    Write-Host "ESP-IDF environment ready. idf.py is available." -ForegroundColor Green
    Write-Host "  idf.py build"
    Write-Host "  idf.py flash -p COM14"
    Write-Host "  idf.py flash monitor -p COM14"
    Write-Host "  idf.py menuconfig"
} else {
    & idf.py @IdfArgs
}
