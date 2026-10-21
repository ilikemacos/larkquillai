# LarkquillAI Local installer for Windows (PowerShell 5.1+).
# Downloads the model from GitHub Releases, checks every SHA256, joins the parts,
# and (if Ollama is installed) registers it as larkquill-local:<size>.
#
# One-line install (PowerShell):
#   $env:LARKQUILL_SIZE='4b'; irm https://raw.githubusercontent.com/ilikemacos/larkquillai-models/main/install/install.ps1 | iex
#   $env:LARKQUILL_SIZE='8b'; irm https://raw.githubusercontent.com/ilikemacos/larkquillai-models/main/install/install.ps1 | iex
# Or after downloading the script:
#   $env:LARKQUILL_SIZE='8b'; powershell -ExecutionPolicy Bypass -File install.ps1

# (No param() block, so the script also works when piped into iex.)
$Size = if ($env:LARKQUILL_SIZE) { $env:LARKQUILL_SIZE } else { '4b' }
$Dir  = if ($env:LARKQUILL_DIR)  { $env:LARKQUILL_DIR }  else { Join-Path $env:USERPROFILE '.larkquill\models' }
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Tag  = 'v1'
$Repo = 'ilikemacos/larkquillai-models'
$Base = if ($env:LARKQUILL_BASE_URL) { $env:LARKQUILL_BASE_URL } else { "https://github.com/$Repo/releases/download/$Tag" }
$Raw  = if ($env:LARKQUILL_RAW_URL) { $env:LARKQUILL_RAW_URL } else { "https://raw.githubusercontent.com/$Repo/main" }

$Models = @{
  '4b' = @{
    File = 'larkquill-local-4b-Q4_K_M.gguf'
    Sha  = 'ba7dc3db75204c76fe8657588397e9357091e2c9797761e5bb38b4d91163fb58'
    NeedGB = 6
    Parts = [ordered]@{
      'part1' = 'ebe8c85d5a21969c7716c68f99693ea9489d075611e66596a2dcfb5a26b3271c'
      'part2' = '6ba386017073f583a3efc4cec1ccd77505832aef51960fe9a7043f950b1c3a33'
    }
  }
  '8b' = @{
    File = 'larkquill-local-8b-Q4_K_M.gguf'
    Sha  = '4f4af5025f0ebaa14373405bd07b65603d0c3078b4eecf6dafc2a19d9811ddf5'
    NeedGB = 11
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
$Target = Join-Path $Dir $Size
New-Item -ItemType Directory -Force -Path $Target | Out-Null
Set-Location $Target

$drive = (Get-Item $Target).PSDrive
if ($drive -and $drive.Free -and ($drive.Free -lt ($M.NeedGB * 1GB))) {
  Die ("Need about {0} GB free on {1}: (have {2:N1} GB)." -f $M.NeedGB, $drive.Name, ($drive.Free / 1GB))
}

$File = $M.File
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

Invoke-WebRequest -UseBasicParsing -Uri "$Raw/modelfiles/Modelfile.$Size" -OutFile 'Modelfile'

if (Get-Command ollama -ErrorAction SilentlyContinue) {
  Say "Registering with Ollama as larkquill-local:$Size ..."
  ollama create "larkquill-local:$Size" -f Modelfile
  if ($LASTEXITCODE -ne 0) { Die "ollama create failed. Is the Ollama app running?" }
  if ($env:LARKQUILL_KEEP_GGUF -ne '1') { Remove-Item -Force $File }  # Ollama keeps its own copy
  Say "Done. Start chatting with:  ollama run larkquill-local:$Size"
  Say "Tip: for faster, direct answers (no step-by-step thinking):  ollama run larkquill-local:$Size --think=false"
} else {
  Say "Ollama is not installed, so the model was not registered."
  Say "Model file: $(Join-Path $Target $File)"
  Say "Install Ollama (https://ollama.com/download), then run:"
  Say "  cd `"$Target`"; ollama create larkquill-local:$Size -f Modelfile; ollama run larkquill-local:$Size"
  Say "Or open the .gguf file in LM Studio or llama.cpp."
}
