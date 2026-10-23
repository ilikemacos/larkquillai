# LarkquillAI Local installer for Windows (PowerShell 5.1+).
# Downloads the model from GitHub Releases, checks every SHA256, joins the parts,
# and (if Ollama is installed) registers it as larkquill-local:<size>.
#
# One-line install (PowerShell):
#   $env:LARKQUILL_SIZE='4b'; irm https://github.com/ilikemacos/larkquillai/releases/download/local-v1/install.ps1 | iex
#   $env:LARKQUILL_SIZE='8b'; irm https://github.com/ilikemacos/larkquillai/releases/download/local-v1/install.ps1 | iex
# Or after downloading the script:
#   $env:LARKQUILL_SIZE='8b'; powershell -ExecutionPolicy Bypass -File install.ps1
#
# Default folder: %USERPROFILE%\LarkquillAI-Local  (visible, not hidden)

# (No param() block, so the script also works when piped into iex.)
$Size = if ($env:LARKQUILL_SIZE) { $env:LARKQUILL_SIZE } else { '4b' }
$Root = if ($env:LARKQUILL_DIR)  { $env:LARKQUILL_DIR }  else { Join-Path $env:USERPROFILE 'LarkquillAI-Local' }
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Tag  = 'local-v1'
$Repo = 'ilikemacos/larkquillai'
$Base = if ($env:LARKQUILL_BASE_URL) { $env:LARKQUILL_BASE_URL } else { "https://github.com/$Repo/releases/download/$Tag" }
$Raw  = if ($env:LARKQUILL_RAW_URL) { $env:LARKQUILL_RAW_URL } else { '' }  # empty = use release asset

$Models = @{
  '4b' = @{
    File = 'larkquill-local-4b-Q4_K_M.gguf'
    Sha  = 'ba7dc3db75204c76fe8657588397e9357091e2c9797761e5bb38b4d91163fb58'
    NeedGB = 6
    Label = '4B'
    Parts = [ordered]@{
      'part1' = 'ebe8c85d5a21969c7716c68f99693ea9489d075611e66596a2dcfb5a26b3271c'
      'part2' = '6ba386017073f583a3efc4cec1ccd77505832aef51960fe9a7043f950b1c3a33'
    }
  }
  '8b' = @{
    File = 'larkquill-local-8b-Q4_K_M.gguf'
    Sha  = '4f4af5025f0ebaa14373405bd07b65603d0c3078b4eecf6dafc2a19d9811ddf5'
    NeedGB = 11
    Label = '8B'
    Parts = [ordered]@{
      'part1' = 'a97de6f8e5f83ab6588cb29828d614f7bde22b23e24da528250f73ef1384724c'
      'part2' = 'd1916bc2e5829a67de90357136a2994aa583b1bf77173befad7c4f7d7d7bc0e5'
      'part3' = '835cd8261d33f58c09de4e5e77f9fa2e742489f8ef15dedc5c73f1c3eb437dcc'
    }
  }
}

function Say($m) { Write-Host "[larkquill] $m" -ForegroundColor Magenta }
function Die($m) { Write-Host "[larkquill] $m" -ForegroundColor Red; throw $m }
function ShaOf($p) { (Get-FileHash -Algorithm SHA256 -Path $p).Hash.ToLower() }

$Size = $Size.ToLower()
if (-not $Models.ContainsKey($Size)) { Die "Unknown size '$Size'. Use 4b or 8b." }
$M = $Models[$Size]
$Target = Join-Path $Root $Size
New-Item -ItemType Directory -Force -Path $Target | Out-Null
New-Item -ItemType Directory -Force -Path $Root | Out-Null
Set-Location $Target

$drive = (Get-Item $Target).PSDrive
if ($drive -and $drive.Free -and ($drive.Free -lt ($M.NeedGB * 1GB))) {
  Die ("Need about {0} GB free on {1}: (have {2:N1} GB)." -f $M.NeedGB, $drive.Name, ($drive.Free / 1GB))
}

$File = $M.File
$Label = $M.Label
if ((Test-Path $File) -and ((ShaOf $File) -eq $M.Sha)) {
  Say "$File is already here and verified."
} else {
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  foreach ($p in $M.Parts.Keys) {
    $pf = "$File.$p"; $want = $M.Parts[$p]
    if ((Test-Path $pf) -and ((ShaOf $pf) -eq $want)) { Say "$pf already downloaded."; continue }
    Say "Downloading $pf ..."
    if ($curl) {
      & $curl.Source -fL --retry 5 --retry-delay 3 -C - -o $pf "$Base/$pf"
      if ($LASTEXITCODE -ne 0) { & $curl.Source -fL --retry 5 -o $pf "$Base/$pf" }
    } else {
      Invoke-WebRequest -UseBasicParsing -Uri "$Base/$pf" -OutFile $pf
    }
    if ((ShaOf $pf) -ne $want) { Remove-Item -Force $pf; Die "Checksum failed for $pf. Please run the installer again." }
    Say "$pf verified."
  }

  Say "Joining parts into $File ..."
  $tmp = "$File.tmp"
  $out = [System.IO.File]::Create((Join-Path $Target $tmp))
  try {
    foreach ($p in $M.Parts.Keys) {
      $in = [System.IO.File]::OpenRead((Join-Path $Target "$File.$p"))
      try { $in.CopyTo($out, 16MB) } finally { $in.Dispose() }
    }
  } finally { $out.Dispose() }
  if ((ShaOf $tmp) -ne $M.Sha) { Remove-Item -Force $tmp; Die "Joined file checksum failed." }
  Move-Item -Force $tmp $File
  Say "$File verified (SHA256 $($M.Sha))."
  if ($env:LARKQUILL_KEEP_PARTS -ne '1') { Get-ChildItem "$File.part*" | Remove-Item -Force }
}

if ($Raw) {
  Invoke-WebRequest -UseBasicParsing -Uri "$Raw/modelfiles/Modelfile.$Size" -OutFile 'Modelfile'
} else {
  Invoke-WebRequest -UseBasicParsing -Uri "$Base/Modelfile.$Size" -OutFile 'Modelfile'
}
if (-not (Test-Path 'Modelfile')) { Die "Could not download the Modelfile." }

# Double-click runner + how-to in the visible root folder.
$Bat = Join-Path $Root "Run LarkquillAI Local $Label.bat"
$GgufPath = Join-Path $Target $File
@"
@echo off
title LarkquillAI Local $Label
where ollama >nul 2>&1
if errorlevel 1 (
  echo Ollama is not installed. Get it from https://ollama.com/download
  echo Or drag this file into LM Studio:
  echo   $GgufPath
  pause
  exit /b 1
)
ollama run larkquill-local:$Size
pause
"@ | Set-Content -Encoding ASCII -Path $Bat

$HowTo = Join-Path $Root 'How to run.txt'
@"
LarkquillAI Local — how to run
==============================

Files are in: $Root
(This is a normal folder in your user profile — not hidden.)

Ollama (easiest after install)
------------------------------
• Double-click  Run LarkquillAI Local $Label.bat
• Or in PowerShell / cmd:  ollama run larkquill-local:$Size

LM Studio (drag and drop)
-------------------------
1. Download the one-file .gguf from the Local page, or use:
   $GgufPath
2. Drag that .gguf onto the LM Studio window (or into My Models).
3. Optional: paste the system prompt from the model guide.

Faster answers in Ollama (skip step-by-step thinking):
  ollama run larkquill-local:$Size --think=false
"@ | Set-Content -Encoding UTF8 -Path $HowTo

if (Get-Command ollama -ErrorAction SilentlyContinue) {
  Say "Registering with Ollama as larkquill-local:$Size ..."
  ollama create "larkquill-local:$Size" -f Modelfile
  if ($LASTEXITCODE -ne 0) { Die "ollama create failed. Is the Ollama app running?" }
  if ($env:LARKQUILL_DELETE_GGUF -eq '1') {
    Remove-Item -Force $File
  } else {
    Say "Kept $GgufPath so you can drag it into LM Studio."
  }
  Say "Done. Folder: $Root"
  Say "Double-click:  Run LarkquillAI Local $Label.bat"
  Say "Or Terminal:   ollama run larkquill-local:$Size"
  Say "Tip: faster answers →  ollama run larkquill-local:$Size --think=false"
} else {
  Say "Ollama is not installed, so the model was not registered."
  Say "Model file (drag into LM Studio): $GgufPath"
  Say "Folder: $Root"
  Say "Install Ollama (https://ollama.com/download), then double-click the Run … .bat"
  Say "  or: cd `"$Target`"; ollama create larkquill-local:$Size -f Modelfile; ollama run larkquill-local:$Size"
}
