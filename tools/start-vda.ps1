param([string]$Runtime = (Join-Path (Split-Path $PSScriptRoot -Parent) '../vda-runtime'))
$ErrorActionPreference = 'Stop'
$VdaPython = Join-Path $Runtime 'venv/Scripts/python.exe'
if (Test-Path (Join-Path $Runtime 'gpu-venv/Scripts/python.exe')) { $VdaPython = Join-Path $Runtime 'gpu-venv/Scripts/python.exe' }
if (!(Test-Path -LiteralPath $VdaPython)) { throw 'Run tools/setup-vda.ps1 first.' }
& $VdaPython (Join-Path $PSScriptRoot 'video_depth_server.py') --runtime $Runtime --port 8788 --input-size 224 --device auto
