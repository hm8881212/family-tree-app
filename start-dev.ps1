# Start both server and client in separate windows
Write-Host "Starting Family Tree Dev..." -ForegroundColor Green

# Start server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\server'; npm run dev" -WindowStyle Normal

Start-Sleep 2

# Start client
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\client'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Server → http://localhost:4000" -ForegroundColor Cyan
Write-Host "Client → http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure server/.env is configured (copy from .env.example)" -ForegroundColor Yellow
