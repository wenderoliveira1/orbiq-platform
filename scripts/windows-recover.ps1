$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Branch = "qa/phase-1.9g-data-continuity"

Set-Location $RepoRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ORBIQ WINDOWS RECOVERY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".git")) {
    throw "A pasta atual não é o repositório Orbiq."
}

$changes = git status --porcelain
if ($changes) {
    Write-Host "Existem alterações locais não salvas." -ForegroundColor Yellow
    Write-Host "Faça commit ou stash antes de continuar. Nenhum arquivo foi apagado." -ForegroundColor Yellow
    return
}

Write-Host "[1/7] Atualizando referências do GitHub..." -ForegroundColor Cyan
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw "Falha no git fetch." }

Write-Host "[2/7] Abrindo branch $Branch..." -ForegroundColor Cyan
git switch $Branch
if ($LASTEXITCODE -ne 0) {
    git switch --track "origin/$Branch"
}
if ($LASTEXITCODE -ne 0) { throw "Falha ao abrir a branch $Branch." }

Write-Host "[3/7] Baixando a versão mais recente..." -ForegroundColor Cyan
git pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Falha no git pull --ff-only." }

Write-Host "[4/7] Encerrando servidor antigo na porta 3000, se existir..." -ForegroundColor Cyan
$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($connections) {
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
    foreach ($processId in $processIds) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

Write-Host "[5/7] Limpando cache do Next.js..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "apps\web\.next" -ErrorAction SilentlyContinue

Write-Host "[6/7] Sincronizando dependências..." -ForegroundColor Cyan
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "Falha no pnpm install." }

Write-Host "[7/7] Iniciando Orbiq..." -ForegroundColor Green
Write-Host ""
Write-Host "O bootstrap agora valida Supabase, migrations e as RPCs da Fase 1.9G antes do Next.js." -ForegroundColor Gray
Write-Host "Quando aparecer Ready, acesse http://localhost:3000" -ForegroundColor Gray
Write-Host "Use Ctrl+C para encerrar." -ForegroundColor Gray
Write-Host ""

pnpm dev
