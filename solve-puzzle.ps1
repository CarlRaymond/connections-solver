param(
    [string]$FilePath = "puzzle.csv"
)

# ── Parse ─────────────────────────────────────────────────────────────────────
$lines = Get-Content $FilePath | Where-Object { $_ -ne "" }
$rows  = [System.Collections.Generic.List[string[]]]::new()
foreach ($line in $lines) {
    $words = ($line -replace '"', '') -split ',' |
             ForEach-Object { $_.Trim() } |
             Where-Object   { $_ -ne "" }
    if ($words.Count -gt 0) { $rows.Add([string[]]$words) }
}

$numRows = $rows.Count
$numCols = ($rows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
Write-Host "Loaded $numRows rows x $numCols columns."
Write-Host "Original arrangement:"
foreach ($row in $rows) { Write-Host "  $($row -join ', ')" }

# ── Permutation generator ─────────────────────────────────────────────────────
function Get-Permutations([string[]]$items) {
    if ($items.Count -le 1) { return , $items }
    $result = [System.Collections.Generic.List[string[]]]::new()
    for ($i = 0; $i -lt $items.Count; $i++) {
        $head = $items[$i]
        $rest = [string[]]@(for ($j = 0; $j -lt $items.Count; $j++) {
            if ($j -ne $i) { $items[$j] }
        })
        foreach ($sub in (Get-Permutations $rest)) {
            $result.Add([string[]](@($head) + $sub))
        }
    }
    return $result.ToArray()
}

# ── Column validity check (compares slot r against slot r-1) ─────────────────
function Test-Valid([string[][]]$arr, [int]$r) {
    if ($r -lt 1) { return $true }
    $prev = $arr[$r - 1]
    $curr = $arr[$r]
    for ($c = 0; $c -lt $curr.Count; $c++) {
        if ([string]::Compare($prev[$c], $curr[$c], $true) -gt 0) { return $false }
    }
    return $true
}

# ── Pre-compute word permutations for every row ───────────────────────────────
$allPerms = @(foreach ($row in $rows) { , (Get-Permutations $row) })
foreach ($r in 0..($numRows - 1)) {
    Write-Host "Row $($r + 1): $($allPerms[$r].Count) permutations"
}

# ── Backtracking search over row order and word order ────────────────────────
# $placed      - indices of input rows placed so far (in chosen order)
# $remaining   - indices of input rows not yet placed
# $solution    - the arranged grid being built
$solution = [string[][]]::new($numRows)

function Search([int[]]$placed, [int[]]$remaining) {
    $depth = $placed.Count
    if ($depth -eq $numRows) { return $true }

    foreach ($idx in $remaining) {
        $nextRemaining = [int[]]@($remaining | Where-Object { $_ -ne $idx })
        foreach ($perm in $allPerms[$idx]) {
            $solution[$depth] = $perm
            if (Test-Valid $solution $depth) {
                if (Search ($placed + $idx) $nextRemaining) { return $true }
            }
        }
        $solution[$depth] = $null
    }
    return $false
}

Write-Host ""
$allIndices = [int[]](0..($numRows - 1))
if (Search @() $allIndices) {
    Write-Host "Solution (each output row is one sorted column):"
    for ($c = 0; $c -lt $numCols; $c++) {
        $col = @(for ($r = 0; $r -lt $numRows; $r++) { $solution[$r][$c] })
        Write-Host "  $($col -join ', ')"
    }
} else {
    Write-Host "No valid arrangement exists for this input."
}
