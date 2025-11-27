param(
  [string]$Arch = "x64"  # options: x64, ia32, arm64
)

Write-Host "=== Media Meta Tagger: Windows build ($Arch) ==="

# Ensure Node is available
try {
  node -v | Out-Null
} catch {
  Write-Error "Node.js is not installed. Please install from https://nodejs.org first."
  exit 1
}

# Install deps
Write-Host "Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Build Windows artifacts
Write-Host "Building Windows distributables..."
# electron-builder picks platform from current OS; we pass the arch
npx electron-builder --win --$Arch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done! Check the dist\\ folder for: .exe (NSIS installer) and .zip (portable)."
