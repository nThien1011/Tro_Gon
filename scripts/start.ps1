$ErrorActionPreference = 'Stop'
$trogonRoot = Split-Path -Parent $PSScriptRoot
$trogonNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $trogonNode) {
  $trogonBundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  if (-not (Test-Path -LiteralPath $trogonBundledNode)) { throw 'Cần cài Node.js 24 LTS.' }
  $trogonExecutable = $trogonBundledNode
} else { $trogonExecutable = $trogonNode.Source }
Set-Location -LiteralPath $trogonRoot
& $trogonExecutable 'scripts/dev.mjs'
exit $LASTEXITCODE
