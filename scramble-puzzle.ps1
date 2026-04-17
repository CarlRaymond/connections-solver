param(
    [string]$FilePath = "puzzle.csv"
)

# Parse all words from the file
$lines = Get-Content $FilePath | Where-Object { $_ -ne "" }
$allWords = @()
foreach ($line in $lines) {
    $words = ($line -replace '"', '') -split ',' |
             ForEach-Object { $_.Trim() } |
             Where-Object   { $_ -ne "" }
    $allWords += $words
}

$total   = $allWords.Count
$numCols = [int][Math]::Sqrt($total)   # assumes square grid
$numRows = $numCols

Write-Host "Pooled $total words, building ${numRows}x${numCols} grid."

# Sort all words — splitting them evenly into columns guarantees solvability:
# column j gets sorted[j*numRows .. (j+1)*numRows - 1], so each column is
# already in order and any row permutation that restores the column assignment
# is a valid solution.
$sorted = $allWords | Sort-Object { $_.ToLower() }

# Build the grid row-major from column-major sorted assignment:
# grid[row][col] = sorted[col * numRows + row]
$rng  = [System.Random]::new()
$grid = @()
for ($row = 0; $row -lt $numRows; $row++) {
    $rowWords = @(for ($col = 0; $col -lt $numCols; $col++) {
        $sorted[$col * $numRows + $row]
    })
    # Fisher-Yates shuffle within the row
    for ($i = $rowWords.Count - 1; $i -gt 0; $i--) {
        $j = $rng.Next($i + 1)
        $rowWords[$i], $rowWords[$j] = $rowWords[$j], $rowWords[$i]
    }
    $grid += , $rowWords
}

# Write back to the CSV file
$lines = foreach ($row in $grid) {
    ($row | ForEach-Object { "`"$_`"" }) -join ", "
}
$lines | Set-Content $FilePath

Write-Host "Scrambled puzzle written to ${FilePath}:"
foreach ($row in $grid) { Write-Host "  $($row -join ', ')" }
