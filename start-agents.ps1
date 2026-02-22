# ============================================================
#  POLICY NAVIGATOR — Start All Agents
#  Run this from the project root:  .\start-agents.ps1
# ============================================================

$ROOT   = Split-Path -Parent $MyInvocation.MyCommand.Path
$PYTHON = "$ROOT\.venv\Scripts\python.exe"

if (-not (Test-Path $PYTHON)) {
    Write-Host "ERROR: Python venv not found at $PYTHON" -ForegroundColor Red
    Write-Host "Create it first:  python -m venv .venv  then  pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

# ── Agents definition ──────────────────────────────────────
$AGENTS = @(
    @{ port=5001; label="Policy Agent";           script="agents/policy-agent/agent.py" },
    @{ port=5002; label="Eligibility Agent";      script="agents/eligibility-agent/agent.py" },
    @{ port=5003; label="Matcher Agent";          script="agents/matcher-agent/agent.py" },
    @{ port=5004; label="Credential Agent";       script="agents/credential-agent/agent.py" },
    @{ port=5005; label="Apply Agent";            script="agents/apply-agent/agent.py" },
    @{ port=5006; label="Form 16 Agent";          script="agents/form16-agent/agent.py" },
    @{ port=5007; label="Form 16 Premium (x402)"; script="agents/form16-premium-agent/agent.py" },
    @{ port=5000; label="Orchestrator";           script="n8n/workflows/agent.py" }   # start last
)

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  POLICY NAVIGATOR — Agent Launcher" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ── Kill existing processes on agent ports ─────────────────
Write-Host "Clearing old processes on ports 5000-5007..." -ForegroundColor Yellow
foreach ($port in 5000..5007) {
    $pids = (netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING") |
                ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique
    foreach ($pid in $pids) {
        if ($pid -match '^\d+$') {
            try { Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
}
Start-Sleep -Seconds 1

# ── Load .env vars into current process environment ────────
foreach ($envFile in @("$ROOT\agents\.env", "$ROOT\.env")) {
    if (Test-Path $envFile) {
        Get-Content $envFile | Where-Object { $_ -match '^\s*[^#=].*=.*' } | ForEach-Object {
            $parts = $_ -split '=', 2
            $k = $parts[0].Trim(); $v = $parts[1].Trim()
            [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
        }
        Write-Host "Loaded env from $envFile" -ForegroundColor Green
    }
}

# ── Launch each agent via cmd wrapper so PORT is isolated ──
$procs = @()
foreach ($agent in $AGENTS) {
    $port   = $agent.port
    $label  = $agent.label
    $script = "$ROOT\$($agent.script)"

    if (-not (Test-Path $script)) {
        Write-Host "  SKIP  $label — script not found ($script)" -ForegroundColor Red
        continue
    }

    # Use cmd /c "set PORT=XXXX && python script.py" so each child gets its own PORT
    $cmdArgs = "/c", "set PORT=$port && `"$PYTHON`" `"$script`""
    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList $cmdArgs `
        -WorkingDirectory $ROOT `
        -NoNewWindow `
        -PassThru

    $procs += $proc
    Write-Host "  STARTED  $label  (port $port, PID $($proc.Id))" -ForegroundColor Green
    Start-Sleep -Milliseconds 800   # stagger startup so registry calls don't clash
}

Write-Host ""
Write-Host "Waiting for agents to initialise..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

# ── Health check ───────────────────────────────────────────
Write-Host ""
Write-Host "Health check:" -ForegroundColor Cyan
$allOk = $true
foreach ($agent in $AGENTS) {
    $port = $agent.port
    $ok   = (Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue).TcpTestSucceeded
    if ($ok) {
        Write-Host ("  [ok]  port {0}  {1}" -f $port, $agent.label) -ForegroundColor Green
    } else {
        Write-Host ("  [!!]  port {0}  {1}  — NOT RESPONDING" -f $port, $agent.label) -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "All agents are up!" -ForegroundColor Green
} else {
    Write-Host "Some agents didn't start. Check their script for errors." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "To start the frontend:   cd web && npm run dev" -ForegroundColor Cyan
Write-Host "Frontend runs at:        http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop watching (agents keep running in background)." -ForegroundColor DarkGray

# Keep process table visible (optional — remove if you don't want the window to stay)
Read-Host "Press ENTER to exit this window"
