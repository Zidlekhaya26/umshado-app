# dev_debug.ps1
# Run from the repository root in PowerShell: `.	ools\dev_debug.ps1`
# This script checks if localhost:3000 is listening and performs a sample POST.

Write-Host "Running Test-NetConnection for localhost:3000..."
Test-NetConnection -ComputerName localhost -Port 3000 | Format-List *

Write-Host "\nAttempting a simple POST to http://127.0.0.1:3000/api/quotes/status ..."
try {
    $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/quotes/status' -Method POST -Headers @{ 'Content-Type'='application/json' } -Body '{}' -UseBasicParsing -ErrorAction Stop
    Write-Host "Status: $($resp.StatusCode)"
    Write-Host "Response:`n$($resp.Content)"
} catch {
    Write-Host "Request failed:`n$($_.Exception.Message)"
    if ($_.Exception.Response) {
        try { $body = $_.Exception.Response.GetResponseStream() | % { $_ } } catch { }
    }
}

Write-Host "\nDone."
