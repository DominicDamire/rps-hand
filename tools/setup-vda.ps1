param([string]$Runtime = (Join-Path (Split-Path $PSScriptRoot -Parent) '../vda-runtime'))
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
$Runtime = (Resolve-Path -LiteralPath $Runtime).Path
$VdaPython = Join-Path $Runtime 'venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $VdaPython)) {
    python -m venv (Join-Path $Runtime 'venv')
    if ($LASTEXITCODE) { throw 'Python 3.10 or newer is required.' }
}
& $VdaPython -m pip install torch==2.14.0 torchvision==0.29.0 --index-url https://download.pytorch.org/whl/cpu
if ($LASTEXITCODE) { throw 'PyTorch installation failed.' }
& $VdaPython -m pip install numpy==2.5.2 opencv-python==5.0.0.93 einops==0.8.2 easydict==1.13 pillow==12.3.0
if ($LASTEXITCODE) { throw 'Dependency installation failed.' }
$VdaSource = Join-Path $Runtime 'Video-Depth-Anything'
if (!(Test-Path -LiteralPath $VdaSource)) {
    git clone https://github.com/DepthAnything/Video-Depth-Anything.git $VdaSource
    if ($LASTEXITCODE) { throw 'Official model code download failed.' }
}
git -C $VdaSource checkout 4f5ae23172ba60fd7bc11ef671cca678842c7072
if ($LASTEXITCODE) { throw 'Could not select tested upstream revision.' }
$VdaCheckpoints = Join-Path $Runtime 'checkpoints'
New-Item -ItemType Directory -Force -Path $VdaCheckpoints | Out-Null
$VdaWeights = Join-Path $VdaCheckpoints 'metric_video_depth_anything_vits.pth'
if (!(Test-Path -LiteralPath $VdaWeights)) {
    Invoke-WebRequest 'https://huggingface.co/depth-anything/Metric-Video-Depth-Anything-Small/resolve/main/metric_video_depth_anything_vits.pth' -OutFile $VdaWeights
}
Write-Output 'Installed. Run tools/start-vda.ps1, then open the Video Depth 1 page on this PC.'
