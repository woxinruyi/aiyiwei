# 批量安装所有扩展依赖
Get-ChildItem extensions -Directory | ForEach-Object {
    $pkgPath = Join-Path $_.FullName "package.json"
    $nmPath = Join-Path $_.FullName "node_modules"
    if ((Test-Path $pkgPath) -and (-not (Test-Path $nmPath))) {
        Write-Host "Installing: $($_.Name)" -ForegroundColor Green
        Push-Location $_.FullName
        npm install --ignore-scripts 2>&1 | Select-Object -Last 3
        Pop-Location
    } else {
        Write-Host "Skipping: $($_.Name)" -ForegroundColor Yellow
    }
}
Write-Host "Done!" -ForegroundColor Green
