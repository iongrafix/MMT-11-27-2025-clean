param(
  [Parameter(Mandatory=$true)][string]$Path
)

$Path = [System.IO.Path]::GetFullPath($Path)
if (!(Test-Path -LiteralPath $Path)) { Write-Error "File not found: $Path"; exit 2 }

$shell  = New-Object -ComObject Shell.Application
$folder = $shell.Namespace((Split-Path -LiteralPath $Path))
if (-not $folder) { Write-Error "Cannot resolve folder for $Path"; exit 3 }
$file   = $folder.ParseName((Split-Path -Leaf -LiteralPath $Path))
if (-not $file)   { Write-Error "Cannot parse file in folder: $Path"; exit 4 }

$idx = @{}
for ($i = 0; $i -lt 400; $i++) {
  $name = $folder.GetDetailsOf($folder.Items, $i)
  if ([string]::IsNullOrWhiteSpace($name)) { continue }
  switch -Regex ($name) {
    '^Title$'     { $idx.Title    = $i }
    '^Tags$'      { $idx.Tags     = $i }
    '^Comments?$' { $idx.Comments = $i }
    '^Rating$'    { $idx.Rating   = $i }
  }
}

$title = ""; $tags = ""; $comments = ""; $rating = 0
if ($idx.Title -ne $null)    { $title    = $folder.GetDetailsOf($file, $idx.Title) }
if ($idx.Tags  -ne $null)    { $tags     = $folder.GetDetailsOf($file, $idx.Tags) -replace ';', ', ' }
if ($idx.Comments -ne $null) { $comments = $folder.GetDetailsOf($file, $idx.Comments) }
if ($idx.Rating -ne $null)   {
  # Explorer shows "★★★☆☆" or "3 stars" strings depending on locale; we normalize to 0–5
  $rStr = $folder.GetDetailsOf($file, $idx.Rating)
  $m = [System.Text.RegularExpressions.Regex]::Match($rStr, '\d')
  if ($m.Success) { $rating = [int]$m.Value } else { $rating = 0 }
}

@{ ok = $true; path = $Path; title = $title; tags = $tags; comments = $comments; rating = $rating } |
  ConvertTo-Json -Compress
