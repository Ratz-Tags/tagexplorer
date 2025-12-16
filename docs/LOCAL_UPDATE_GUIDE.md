# Local Update Guide

## Running Updates Locally

Instead of waiting for GitHub Actions (which can take an hour), you can run the update scripts locally and create PRs manually.

### Quick Start

**Windows (PowerShell):**
```powershell
# Just update the files locally
npm run update:tags:local

# Or use the helper script to create a PR automatically
.\scripts\update-kink-tags-local.ps1 -CreatePR
```

**Linux/Mac (Bash):**
```bash
# Just update the files locally
npm run update:tags:local

# Or use the helper script to create a PR automatically
./scripts/update-kink-tags-local.sh --pr
```

### Manual Process

1. **Run the update script:**
   ```bash
   npm run update:tags:local
   # or
   node scripts/updateKinkTags.js
   ```

2. **Check what changed:**
   ```bash
   git status
   git diff
   ```

3. **Create a branch and commit:**
   ```bash
   git checkout -b update/kink-tags-$(date +%Y%m%d)
   git add -A
   git commit -m "chore: update kink-tags.json (local run)"
   ```

4. **Push and create PR:**
   ```bash
   git push -u origin update/kink-tags-$(date +%Y%m%d)
   # Then create PR on GitHub, or use GitHub CLI:
   gh pr create --title "chore: update kink-tags.json" --base Holding
   ```

### Benefits of Local Updates

- ✅ **Faster**: Run on your machine, no queue time
- ✅ **Control**: See progress in real-time
- ✅ **Flexibility**: Stop/resume as needed
- ✅ **No blocking**: GitHub Actions won't interfere
- ✅ **PR workflow**: Review changes before merging

### GitHub Actions vs Local

**GitHub Actions (Current):**
- Runs automatically on schedule
- Creates PR automatically
- Uses GitHub's compute time
- Can take 1+ hours
- May conflict with other workflows

**Local (Recommended):**
- Run when you want
- Create PR when ready
- Uses your machine
- Can monitor progress
- No conflicts

### Workflow Recommendations

1. **For regular updates**: Run locally weekly/monthly
2. **For urgent updates**: Run locally immediately
3. **For automated updates**: Keep GitHub Actions as backup
4. **For testing**: Always test locally first

### Troubleshooting

**Script takes too long?**
- The script is rate-limited to respect Danbooru API
- It processes many tags and artists
- This is normal - expect 30-60 minutes

**Want to speed it up?**
- Adjust `MAX_CONCURRENCY` in the script (default: 8)
- Adjust `BASE_DELAY_MS` (default: 150ms)
- Set environment variables:
  ```bash
  export DANBOORU_CONCURRENCY=12
  export DANBOORU_BASE_DELAY_MS=100
  npm run update:tags:local
  ```

**GitHub CLI not installed?**
```bash
# Windows (via winget or scoop)
winget install GitHub.cli

# Mac
brew install gh

# Linux
# See: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

