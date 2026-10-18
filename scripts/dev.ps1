$ErrorActionPreference = 'Stop'
$trogonRoot = Split-Path -Parent $PSScriptRoot
$trogonNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $trogonNode) { throw 'Cần cài Node.js 22.13 trở lên.' }
Set-Location -LiteralPath $trogonRoot
if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) { throw 'Cần chạy npm install trước.' }
& $trogonNode.Source 'node_modules/vite/bin/vite.js' --host 127.0.0.1 --port 5173
exit $LASTEXITCODE
