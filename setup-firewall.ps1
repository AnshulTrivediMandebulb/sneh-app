# PowerShell script to configure Windows Firewall for Expo
# Run this script as Administrator

Write-Host "Creating Windows Firewall rules for Expo..." -ForegroundColor Green

# Rule for Expo Metro Bundler (port 8081)
New-NetFirewallRule -DisplayName "Expo Metro Bundler" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 8081 `
    -Action Allow `
    -Profile Private `
    -ErrorAction SilentlyContinue

# Rule for Expo DevTools (port 19000)
New-NetFirewallRule -DisplayName "Expo DevTools 19000" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 19000 `
    -Action Allow `
    -Profile Private `
    -ErrorAction SilentlyContinue

# Rule for Expo DevTools (port 19001)
New-NetFirewallRule -DisplayName "Expo DevTools 19001" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 19001 `
    -Action Allow `
    -Profile Private `
    -ErrorAction SilentlyContinue

# Rule for Backend Server (port 3000)
New-NetFirewallRule -DisplayName "Backend Server 3000" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3000 `
    -Action Allow `
    -Profile Private `
    -ErrorAction SilentlyContinue

Write-Host "Firewall rules created successfully!" -ForegroundColor Green
Write-Host "You can now use Expo in LAN mode." -ForegroundColor Cyan
