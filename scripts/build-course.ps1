<#
.SYNOPSIS
    Generate course content from transcripts and register it with the site.
    Single command: generate -> register -> build.

.EXAMPLE
    .\scripts\build-course.ps1
    .\scripts\build-course.ps1 -Sections "2,3"
    .\scripts\build-course.ps1 -DryRun
#>

param(
    [string]$Sections = "",
    [int]$Workers = 0,
    [switch]$DryRun,
    [switch]$SkipBuild,
    [switch]$SkipRegister
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

# --- Banner ---
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       TRANSCRIPT -> COURSE GENERATOR PIPELINE              " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Load .env ---
$envFile = Join-Path $ProjectRoot ".env"
if (Test-Path $envFile) {
    Write-Host "[1/5] Loading .env configuration..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2
            if ($parts.Count -eq 2) {
                $key = $parts[0].Trim()
                $val = $parts[1].Trim()
                [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
                if ($key -like "*KEY*" -or $key -like "*SECRET*") {
                    $masked = $val.Substring([Math]::Max(0, $val.Length - 8))
                    Write-Host "       $key = ****$masked" -ForegroundColor DarkGray
                } else {
                    Write-Host "       $key = $val" -ForegroundColor DarkGray
                }
            }
        }
    }
} else {
    Write-Host "[ERROR] No .env file found at $envFile" -ForegroundColor Red
    Write-Host "       Create one with NVIDIA_API_KEY, TRANSCRIPT_FOLDER, COURSE_SLUG, COURSE_TITLE" -ForegroundColor Red
    exit 1
}

# --- Resolve configuration ---
$TranscriptFolder = $env:TRANSCRIPT_FOLDER
$CourseSlug = if ($env:COURSE_SLUG) { $env:COURSE_SLUG } else { "webflux" }
$CourseTitle = if ($env:COURSE_TITLE) { $env:COURSE_TITLE } else { "Spring WebFlux" }
$WorkerCount = if ($Workers -gt 0) { $Workers } elseif ($env:WORKERS) { [int]$env:WORKERS } else { 5 }

if (-not $TranscriptFolder) {
    Write-Host "[ERROR] TRANSCRIPT_FOLDER not set in .env" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $TranscriptFolder)) {
    Write-Host "[ERROR] Transcript folder not found: $TranscriptFolder" -ForegroundColor Red
    exit 1
}
if (-not $env:API_KEY -and -not $env:GEMINI_API_KEY -and -not $env:NVIDIA_API_KEY -and -not $DryRun) {
    Write-Host "[ERROR] No API key set in .env (API_KEY, GEMINI_API_KEY, or NVIDIA_API_KEY)" -ForegroundColor Red
    exit 1
}

$ModelName = if ($env:MODEL) { $env:MODEL } else { "gemini-2.5-flash" }

Write-Host ""
Write-Host "  Configuration:" -ForegroundColor White
Write-Host "    Slug:        $CourseSlug" -ForegroundColor Gray
Write-Host "    Title:       $CourseTitle" -ForegroundColor Gray
Write-Host "    Model:       $ModelName" -ForegroundColor Gray
Write-Host "    Transcripts: $TranscriptFolder" -ForegroundColor Gray
Write-Host "    Workers:     $WorkerCount" -ForegroundColor Gray
if ($Sections) { Write-Host "    Sections:    $Sections" -ForegroundColor Gray }
Write-Host ""

# --- Step 2: Install Python dependencies ---
Write-Host "[2/5] Checking Python dependencies..." -ForegroundColor Yellow
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& py -m pip install -q -r scripts/requirements.txt 2>$null
$ErrorActionPreference = $prevPref
if ($LASTEXITCODE -ne 0) {
    Write-Host "       pip install failed - check scripts/requirements.txt" -ForegroundColor Red
    exit 1
}
Write-Host "       [OK] Dependencies ready" -ForegroundColor Green

# --- Step 3: Generate lesson content ---
Write-Host ""
Write-Host "[3/5] Generating lesson content from transcripts..." -ForegroundColor Yellow
Write-Host "       (Calling NVIDIA API - may take several minutes)" -ForegroundColor DarkGray
Write-Host ""

$generateArgs = @(
    "scripts/generate-from-transcripts.py",
    $TranscriptFolder,
    "--course-slug", $CourseSlug,
    "--course-title", $CourseTitle,
    "--workers", $WorkerCount
)
if ($Sections) { $generateArgs += @("--sections", $Sections) }
if ($DryRun)   { $generateArgs += "--dry-run" }

& py @generateArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Content generation failed." -ForegroundColor Red
    exit 1
}

if ($DryRun) {
    Write-Host ""
    Write-Host "[DRY RUN COMPLETE] No files were written." -ForegroundColor Yellow
    exit 0
}

# --- Step 4: Register course ---
if (-not $SkipRegister) {
    Write-Host ""
    Write-Host "[4/5] Registering course in courseRegistry.js..." -ForegroundColor Yellow

    $lessonsDir = Join-Path $ProjectRoot "src/data/$CourseSlug-lessons"
    $sectionFiles = Get-ChildItem $lessonsDir -Filter "section*.js" -ErrorAction SilentlyContinue
    $sectionCount = @($sectionFiles).Count

    if ($sectionCount -eq 0) {
        Write-Host "       [WARN] No section files found - skipping registration" -ForegroundColor DarkYellow
    } else {
        & py scripts/register-course.py --slug $CourseSlug --title $CourseTitle --sections $sectionCount
        if ($LASTEXITCODE -ne 0) {
            Write-Host "       [WARN] Registration had issues - check courseRegistry.js" -ForegroundColor DarkYellow
        } else {
            Write-Host "       [OK] Course registered ($sectionCount sections)" -ForegroundColor Green
        }
    }
} else {
    Write-Host ""
    Write-Host "[4/5] Skipping registration (-SkipRegister)" -ForegroundColor DarkGray
}

# --- Step 5: Build site ---
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "[5/5] Building site with Vite..." -ForegroundColor Yellow
    & npx vite build 2>&1 | ForEach-Object { Write-Host "       $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "       [ERROR] Build failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "       [OK] Build complete -> dist/" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[5/5] Skipping build (-SkipBuild)" -ForegroundColor DarkGray
}

# --- Done ---
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "                  PIPELINE COMPLETE                         " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Run 'npm run preview' to view the site locally." -ForegroundColor Gray
Write-Host ""
