$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " ORBIQ WINDOWS RECOVERY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".git")) {
    throw "A pasta atual não é o repositório Orbiq."
}

$Branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($Branch)) {
    throw "Não foi possível identificar a branch atual."
}

$changes = git status --porcelain
if ($changes) {
    Write-Host "Existem alterações locais não salvas." -ForegroundColor Yellow
    Write-Host "Faça commit ou stash antes de continuar. Nenhum arquivo foi apagado." -ForegroundColor Yellow
    return
}

$Lockfile = Join-Path $RepoRoot "pnpm-lock.yaml"
$NodeModules = Join-Path $RepoRoot "node_modules"
$LockHashBefore = if (Test-Path $Lockfile) {
    (Get-FileHash $Lockfile -Algorithm SHA256).Hash
} else {
    $null
}

Write-Host "Branch atual: $Branch" -ForegroundColor Gray
Write-Host ""

Write-Host "[1/7] Atualizando referências do GitHub..." -ForegroundColor Cyan
git fetch origin --prune
if ($LASTEXITCODE -ne 0) { throw "Falha no git fetch." }

Write-Host "[2/7] Atualizando $Branch sem reescrever histórico..." -ForegroundColor Cyan
git pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) { throw "Falha no git pull --ff-only." }

Write-Host "[3/7] Encerrando servidor antigo na porta 3000, se existir..." -ForegroundColor Cyan
$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($connections) {
    $processIds = $connections | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
    foreach ($processId in $processIds) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

Write-Host "[4/7] Limpando cache do Next.js..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "apps\web\.next" -ErrorAction SilentlyContinue

$LockHashAfter = if (Test-Path $Lockfile) {
    (Get-FileHash $Lockfile -Algorithm SHA256).Hash
} else {
    $null
}

$DependenciesNeedSync = (-not (Test-Path $NodeModules)) -or ($LockHashBefore -ne $LockHashAfter)

Write-Host "[5/7] Verificando dependências..." -ForegroundColor Cyan
if ($DependenciesNeedSync) {
    Write-Host "Lockfile mudou ou node_modules não existe. Sincronizando com preferência pelo cache local..." -ForegroundColor Yellow
    pnpm install --frozen-lockfile --prefer-offline
    if ($LASTEXITCODE -ne 0) { throw "Falha no pnpm install." }
} else {
    Write-Host "[OK] Dependências já sincronizadas; download desnecessário foi evitado." -ForegroundColor Green
}

Write-Host "[6/7] Confirmando versão local..." -ForegroundColor Cyan
git log -1 --oneline

Write-Host "[7/7] Iniciando Orbiq..." -ForegroundColor Green
Write-Host ""
Write-Host "O bootstrap valida Supabase, migrations, RPCs e ambiente antes do Next.js." -ForegroundColor Gray
Write-Host "Quando aparecer Ready, acesse http://localhost:3000" -ForegroundColor Gray
Write-Host "Use Ctrl+C para encerrar." -ForegroundColor Gray
Write-Host ""

pnpm dev
