# Family Tree - Local Docker Start
# Usage: .\start-local.ps1

Write-Host "🌳 Family Tree App - Local Setup" -ForegroundColor Green
Write-Host ""

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker not found. Install Docker Desktop from:" -ForegroundColor Red
    Write-Host "   https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Docker found" -ForegroundColor Green
Write-Host "🚀 Starting services (first run builds images — takes 2-3 min)..." -ForegroundColor Yellow
Write-Host ""

docker compose up --build

Write-Host ""
Write-Host "App stopped." -ForegroundColor Gray
