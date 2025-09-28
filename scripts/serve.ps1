# Lightweight PowerShell helper to serve the static site locally
# Usage: ./scripts/serve.ps1

$port = 8080
Write-Host "Starting static server on http://localhost:$port"

# Prefer http-server if available, otherwise fallback to Python
if (Get-Command npx -ErrorAction SilentlyContinue) {
    npx http-server -c-1 . -p $port
} else {
    python -m http.server $port
}
