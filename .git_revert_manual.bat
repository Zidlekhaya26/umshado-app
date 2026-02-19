git stash push -u -m "wip before revert"
git status --porcelain
git revert --abort || echo aborted
git add -A
git rm --cached --ignore-unmatch components\PublicVendorCTAs.tsx || echo rm1
git rm --cached --ignore-unmatch app\v\[vendorId]\page.tsx || echo rm2
git commit -m "Revert 381b401: restore parent versions and remove public vendor files (manual)" || echo no-commit
git log -n1 --oneline
