# 포터블 실행 파일 옆에 조작/송출 바로가기를 만듭니다.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path (Join-Path $root "은혜로운 예배.exe"))) {
  $root = Get-Location
}
$exe = Join-Path $root "은혜로운 예배.exe"
if (-not (Test-Path $exe)) {
  Write-Error "은혜로운 예배.exe 를 찾지 못했습니다. win-unpacked 폴더에서 실행하세요."
}

$shell = New-Object -ComObject WScript.Shell
function New-AppShortcut($name, $args) {
  $path = Join-Path $root "$name.lnk"
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = $exe
  $shortcut.Arguments = $args
  $shortcut.WorkingDirectory = $root
  $shortcut.Save()
  Write-Host "만든 바로가기: $path"
}

New-AppShortcut "은혜로운 예배 조작" ""
New-AppShortcut "은혜로운 예배 송출" "--mode=output --display=main"
New-AppShortcut "은혜로운 예배 오버레이" "--mode=output --display=overlay"
