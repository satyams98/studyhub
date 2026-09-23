<#
.SYNOPSIS
    Generate the Spring Batch course from a curriculum JSON file and register it with the site.
    Pipeline: generate -> register -> build.

.DESCRIPTION
    Uses generate-from-curriculum.py (curriculum-based generator) instead of the
    transcript-based generator. Reads scripts/spring-batch-curriculum.json by default.

.EXAMPLE
    .\scripts\build-batch-course.ps1
    .\scripts\build-batch-course.ps1 -Sections "11"
    .\scripts\build-batch-course.ps1 -Sections "11,12" -Workers 8
    .\scripts\build-batch-course.ps1 -DryRun
    .\scripts\build-batch-course.ps1 -Force -SkipBuild
#>

param(
    [string]$Sections     = "",
    [int]$Workers         = 0,
    [string]$CurriculumFile = "",
    [switch]$DryRun,
    [switch]$SkipBuild,
    [switch]$SkipRegister,
    [switch]$Ollama,
    [switch]$Force,
    [switch]$GlossaryOnly
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

# ─── Banner ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "     SPRING BATCH COURSE GENERATOR PIPELINE                 " -ForegroundColor Cyan
Write-Host "     (curriculum-based, no transcripts needed)              " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ─── Step 1: Load .env ────────────────────────────────────────────────────────
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
    Write-Host "[WARN] No .env file found — using defaults and environment variables." -ForegroundColor DarkYellow
}

# ─── Resolve configuration ────────────────────────────────────────────────────
# CurriculumFile: parameter > .env CURRICULUM_FILE > default
if (-not $CurriculumFile) {
    $CurriculumFile = if ($env:CURRICULUM_FILE) { $env:CURRICULUM_FILE } else {
        Join-Path $ProjectRoot "scripts/spring-batch-curriculum.json"
    }
}
if (-not (Test-Path $CurriculumFile)) {
    Write-Host "[ERROR] Curriculum file not found: $CurriculumFile" -ForegroundColor Red
    exit 1
}

# Read slug and title from the curriculum JSON (PowerShell native JSON parsing)
$CurriculumJson = Get-Content $CurriculumFile -Raw | ConvertFrom-Json
$CourseSlug     = if ($env:COURSE_SLUG)  { $env:COURSE_SLUG  } else { $CurriculumJson.slug  }
$CourseTitle    = if ($env:COURSE_TITLE) { $env:COURSE_TITLE } else { $CurriculumJson.title }
$WorkerCount    = if ($Workers -gt 0) { $Workers } elseif ($env:WORKERS) { [int]$env:WORKERS } else { 5 }

if (-not $env:API_KEY -and -not $env:GEMINI_API_KEY -and -not $env:NVIDIA_API_KEY -and -not $DryRun -and -not $Ollama) {
    Write-Host "[ERROR] No API key set. Add API_KEY, GEMINI_API_KEY, or NVIDIA_API_KEY to .env" -ForegroundColor Red
    exit 1
}

$ModelName   = if ($env:MODEL)        { $env:MODEL }        else { "gemini-2.5-flash" }
$OllamaModel = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { "minimax-m3:cloud" }
$OllamaHost  = if ($env:OLLAMA_HOST)  { $env:OLLAMA_HOST }  else { "http://localhost:11434" }

Write-Host ""
Write-Host "  Configuration:" -ForegroundColor White
Write-Host "    Slug:        $CourseSlug"       -ForegroundColor Gray
Write-Host "    Title:       $CourseTitle"      -ForegroundColor Gray
Write-Host "    Curriculum:  $CurriculumFile"   -ForegroundColor Gray
if ($Ollama) {
    Write-Host "    Backend:     Ollama (local)"  -ForegroundColor Gray
    Write-Host "    Host:        $OllamaHost"     -ForegroundColor Gray
    Write-Host "    Model:       $OllamaModel"    -ForegroundColor Gray
} else {
    Write-Host "    Backend:     API"             -ForegroundColor Gray
    Write-Host "    Model:       $ModelName"      -ForegroundColor Gray
}
Write-Host "    Workers:     $WorkerCount"      -ForegroundColor Gray
if ($Sections) { Write-Host "    Sections:    $Sections" -ForegroundColor Gray }
Write-Host ""

# ─── Step 2: Install Python dependencies ─────────────────────────────────────
Write-Host "[2/5] Checking Python dependencies..." -ForegroundColor Yellow
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& py -m pip install -q -r scripts/requirements.txt 2>$null
$ErrorActionPreference = $prevPref
if ($LASTEXITCODE -ne 0) {
    Write-Host "       pip install failed — check scripts/requirements.txt" -ForegroundColor Red
    exit 1
}
Write-Host "       [OK] Dependencies ready" -ForegroundColor Green

# ─── Step 3: Generate lesson content from curriculum ─────────────────────────
Write-Host ""
Write-Host "[3/5] Generating lesson content from curriculum..." -ForegroundColor Yellow
if ($Ollama) {
    Write-Host "       (Calling local Ollama — may take several minutes)" -ForegroundColor DarkGray
} else {
    Write-Host "       (Calling remote API — may take several minutes)" -ForegroundColor DarkGray
}
Write-Host ""

$generateArgs = @(
    "scripts/generate-from-curriculum.py",
    $CurriculumFile,
    "--course-slug",  $CourseSlug,
    "--course-title", $CourseTitle,
    "--workers",      $WorkerCount
)
if ($Sections)     { $generateArgs += @("--sections", $Sections) }
if ($DryRun)       { $generateArgs += "--dry-run"      }
if ($Ollama)       { $generateArgs += "--ollama"       }
if ($Force)        { $generateArgs += "--force"        }
if ($GlossaryOnly) { $generateArgs += "--glossary-only" }

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

# ─── Step 4: Register course ──────────────────────────────────────────────────
if (-not $SkipRegister) {
    Write-Host ""
    Write-Host "[4/5] Registering course in courseRegistry.js..." -ForegroundColor Yellow

    $lessonsDir   = Join-Path $ProjectRoot "src/data/$CourseSlug-lessons"
    $sectionFiles = Get-ChildItem $lessonsDir -Filter "section*.js" -ErrorAction SilentlyContinue
    $sectionCount = @($sectionFiles).Count

    if ($sectionCount -eq 0) {
        Write-Host "       [WARN] No section files found — skipping registration" -ForegroundColor DarkYellow
    } else {
        & py scripts/register-course.py `
            --slug     $CourseSlug  `
            --title    $CourseTitle `
            --sections $sectionCount `
            --tags     "Java,Spring,Batch" `
            --color    "#E0A63A"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "       [WARN] Registration had issues — check courseRegistry.js" -ForegroundColor DarkYellow
        } else {
            Write-Host "       [OK] Course registered ($sectionCount sections)" -ForegroundColor Green
        }
    }
} else {
    Write-Host ""
    Write-Host "[4/5] Skipping registration (-SkipRegister)" -ForegroundColor DarkGray
}

# ─── Step 5: Build site ───────────────────────────────────────────────────────
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

# ─── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "                  PIPELINE COMPLETE                         " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "    npm run preview     — view the site locally" -ForegroundColor Gray
Write-Host "    npm run dev         — start dev server with hot-reload" -ForegroundColor Gray
Write-Host ""
Write-Host "  To regenerate specific sections:" -ForegroundColor White
Write-Host "    .\scripts\build-batch-course.ps1 -Sections '11,12' -Force -SkipBuild" -ForegroundColor Gray
Write-Host "    .\scripts\build-batch-course.ps1 -GlossaryOnly -SkipBuild" -ForegroundColor Gray
Write-Host ""
