# Local PowerShell script to update kink tags and optionally create a PR
# Usage: .\scripts\update-kink-tags-local.ps1 [-CreatePR]

param(
    [switch]$CreatePR
)

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$branch = "update/kink-tags-$timestamp"

Write-Host "🚀 Starting kink tags update..." -ForegroundColor Cyan
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No dependencies needed or install failed" -ForegroundColor Yellow
}

Write-Host "🔄 Running update script..." -ForegroundColor Cyan
node scripts/updateKinkTags.js

# Check if there are changes
$hasChanges = $false
try {
    $diff = git diff --quiet 2>&1
    $cached = git diff --cached --quiet 2>&1
    if ($LASTEXITCODE -ne 0) {
        $hasChanges = $true
    }
} catch {
    $hasChanges = $true
}

if (-not $hasChanges) {
    Write-Host "✅ No changes to commit." -ForegroundColor Green
    exit 0
}

Write-Host "📝 Changes detected, committing..." -ForegroundColor Yellow

# Create a new branch
try {
    git checkout -b $branch 2>&1 | Out-Null
} catch {
    git checkout $branch 2>&1 | Out-Null
}

# Commit changes
git add -A
git commit -m "chore: update kink-tags.json (local run)" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Nothing to commit" -ForegroundColor Yellow
}

if ($CreatePR) {
    Write-Host "🔀 Pushing branch and creating PR..." -ForegroundColor Cyan
    git push -u origin $branch
    
    # Create PR using GitHub CLI (requires gh CLI to be installed)
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        gh pr create `
            --title "chore: update kink-tags.json (local run)" `
            --body "Local update of kink-tags.json and artists.json`n`nThis PR was created from a local run of the update script.`nReview the changes and merge when ready." `
            --base Holding `
            --head $branch `
            --label "automated,data-update" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Failed to create PR (may already exist)" -ForegroundColor Yellow
        } else {
            Write-Host "✅ PR created successfully!" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠️  GitHub CLI (gh) not installed. Push the branch manually and create a PR:" -ForegroundColor Yellow
        Write-Host "   Branch: $branch" -ForegroundColor Cyan
        Write-Host "   Base: Holding" -ForegroundColor Cyan
    }
} else {
    Write-Host "✅ Changes committed to branch: $branch" -ForegroundColor Green
    Write-Host "💡 To create a PR, run: git push -u origin $branch" -ForegroundColor Cyan
    Write-Host "   Or run this script with -CreatePR flag: .\scripts\update-kink-tags-local.ps1 -CreatePR" -ForegroundColor Cyan
}

