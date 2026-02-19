tasklist /FI "IMAGENAME eq git.exe"

taskkill /F /IM git.exe || echo no-git-process

ping -n 2 127.0.0.1 >nul

if exist .git\index.lock del /f .git\index.lock && echo index-lock-removed || echo failed-to-remove-lock

git add -A

git rm --cached --ignore-unmatch components\PublicVendorCTAs.tsx || echo rm1

git rm --cached --ignore-unmatch app\v\[vendorId]\page.tsx || echo rm2

git commit -m "Revert 381b401: restore parent versions and remove public vendor files (manual)" || echo no-commit

git log -n1 --oneline
