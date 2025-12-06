
# Script to remove "DATABASE_URL " from origin/main without checkout
# This works by manipulating a temporary index

$ErrorActionPreference = "Stop"
$Env:GIT_INDEX_FILE = ".git/replit_fix_index"

try {
    Write-Host "Fetching origin..."
    git fetch origin

    Write-Host "Reading origin/main into temp index..."
    git read-tree "origin/main"

    Write-Host "Removing invalid file from index..."
    git rm --cached "DATABASE_URL "

    Write-Host "Writing new tree..."
    $treeParams = @()
    $newTree = git write-tree
    Write-Host "New Tree: $newTree"

    Write-Host "Creating new commit..."
    # get current tip of origin/main
    $parent = git rev-parse origin/main
    $msg = "chore: remove invalid DATABASE_URL file"
    $newCommit = git commit-tree $newTree -p $parent -m $msg
    Write-Host "New Commit: $newCommit"

    Write-Host "Pushing fix to origin/main..."
    git push origin "$newCommit`:main"

    Write-Host "SUCCESS: Remote fixed."
} catch {
    Write-Error "Failed: $_"
    exit 1
} finally {
    # cleanup
    if (Test-Path $Env:GIT_INDEX_FILE) {
        Remove-Item $Env:GIT_INDEX_FILE
    }
}
