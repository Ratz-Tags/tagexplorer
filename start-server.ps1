# TagExplorer Quick Start Server
# Run this with: .\start-server.ps1

$port = 8080
$path = Get-Location

Write-Host "🚀 Starting TagExplorer dev server on port $port..." -ForegroundColor Cyan
Write-Host "📂 Serving from: $path" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 Open in browser:" -ForegroundColor Green
Write-Host "   http://localhost:$port" -ForegroundColor Yellow
Write-Host "   http://localhost:$port/gallery/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Start Python's built-in HTTP server (most reliable cross-platform)
if (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server $port
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 -m http.server $port
} else {
    Write-Host "❌ Python not found. Installing http-server via npm..." -ForegroundColor Red
    npm install -g http-server
    npx http-server -c-1 . -p $port
}
