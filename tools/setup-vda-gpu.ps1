param([string]$Runtime = (Join-Path (Split-Path $PSScriptRoot -Parent) '../vda-runtime'))
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $Runtime 'checkpoints/metric_video_depth_anything_vits.pth'))) { & (Join-Path $PSScriptRoot 'setup-vda.ps1') -Runtime $Runtime }
if (!(Get-Command uv -ErrorAction SilentlyContinue)) { throw 'Install uv (astral-sh.uv) first. This setup uses an isolated Python 3.12 environment for DirectML.' }
$GpuPython = Join-Path $Runtime 'gpu-venv/Scripts/python.exe'
if (!(Test-Path $GpuPython)) { uv venv --python 3.12 (Join-Path $Runtime 'gpu-venv'); if ($LASTEXITCODE) { throw 'GPU Python setup failed.' } }
uv pip install --python $GpuPython torch-directml==0.2.5.dev240914 opencv-python==4.11.0.86 numpy==1.26.4 einops==0.8.2 easydict==1.13 pillow==12.3.0
if ($LASTEXITCODE) { throw 'DirectML installation failed.' }
& $GpuPython (Join-Path $PSScriptRoot 'prepare_directml.py') $Runtime
if ($LASTEXITCODE) { throw 'FP32 compatibility patch failed.' }
Write-Output 'GPU engine installed. Run tools/start-vda.ps1. GPU selection and quality are adjustable on the page.'
