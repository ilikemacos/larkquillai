# WrenbyAI desktop installer for Windows.
#   irm https://ilikemacos.github.io/wrenbyai/install.ps1 | iex
# Set $env:WRENBYAI_DRY_RUN = "1" to only print what would be downloaded.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Repo = 'ilikemacos/wyneai-desktop'
function Say($m) { Write-Host "==> $m" -ForegroundColor Cyan }

Say 'Finding the latest WrenbyAI release...'
try { $rel = Invoke-RestMethod -Headers @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'wrenbyai-installer' } -Uri "https://api.github.com/repos/$Repo/releases/latest" }
catch { throw "Couldn't reach the GitHub API: $($_.Exception.Message)" }
$asset = $rel.assets | Where-Object { $_.name -like '*_x64-setup.exe' } | Select-Object -First 1
if (-not $asset) { throw "No Windows installer found in release $($rel.tag_name)" }
Say "Latest release: $($rel.tag_name)"
if ($env:WRENBYAI_DRY_RUN -eq '1') { Say "Dry run: would download $($asset.browser_download_url)"; return }

$tmp = Join-Path $env:TEMP $asset.name
Say "Downloading $($asset.name) ($([math]::Round($asset.size / 1MB, 1)) MB)..."
Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $tmp
Say 'Installing silently...'
$p = Start-Process -FilePath $tmp -ArgumentList '/S' -Wait -PassThru
if ($p.ExitCode -ne 0) { throw "Installer exited with code $($p.ExitCode)" }
Remove-Item $tmp -ErrorAction SilentlyContinue

# The NSIS installer is per-user; make sure a Start menu shortcut exists.
$exe = @("$env:LOCALAPPDATA\WrenbyAI\WrenbyAI.exe", "$env:LOCALAPPDATA\Programs\WrenbyAI\WrenbyAI.exe", "$env:ProgramFiles\WrenbyAI\WrenbyAI.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$lnk = Join-Path ([Environment]::GetFolderPath('Programs')) 'WrenbyAI.lnk'
if ($exe -and -not (Test-Path $lnk)) {
  Say 'Adding a Start menu entry...'
  $sh = New-Object -ComObject WScript.Shell; $s = $sh.CreateShortcut($lnk); $s.TargetPath = $exe; $s.WorkingDirectory = Split-Path $exe; $s.Save()
}
Say "Done. WrenbyAI $($rel.tag_name) is installed$(if ($exe) { " at $exe" }). Find it in the Start menu."
