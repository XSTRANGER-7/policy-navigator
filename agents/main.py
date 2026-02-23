"""
Policy Navigator — Agent Supervisor
=====================================
Starts all 8 agents as subprocesses for Railway deployment.

Binding strategy:
  Citizen Agent (Orchestrator) → binds to $PORT  (Railway's public port)
  All other agents             → bind to fixed internal ports 5001–5007
  Inter-agent URLs             → resolved via env vars (default to localhost)

Usage:
  python agents/main.py
"""

import os
import sys
import subprocess
import signal
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Public Railway $PORT is given to the orchestrator.
# All other agents use fixed internal ports.
ORCHESTRATOR_PORT = os.environ.get("PORT", "5000")

AGENTS = [
    # Sub-agents start first so orchestrator can reach them
    {
        "script": "agents/policy-agent/agent.py",
        "port": os.environ.get("POLICY_AGENT_PORT", "5001"),
        "label": "Policy Agent",
    },
    {
        "script": "agents/eligibility-agent/agent.py",
        "port": os.environ.get("ELIGIBILITY_AGENT_PORT", "5002"),
        "label": "Eligibility Agent",
    },
    {
        "script": "agents/matcher-agent/agent.py",
        "port": os.environ.get("MATCHER_AGENT_PORT", "5003"),
        "label": "Matcher Agent",
    },
    {
        "script": "agents/credential-agent/agent.py",
        "port": os.environ.get("CREDENTIAL_AGENT_PORT", "5004"),
        "label": "Credential Agent",
    },
    {
        "script": "agents/apply-agent/agent.py",
        "port": os.environ.get("APPLY_AGENT_PORT", "5005"),
        "label": "Apply Agent",
    },
    {
        "script": "agents/form16-agent/agent.py",
        "port": os.environ.get("FORM16_AGENT_PORT", "5006"),
        "label": "Form 16 Agent",
    },
    {
        "script": "agents/form16-premium-agent/agent.py",
        "port": os.environ.get("FORM16_PREMIUM_AGENT_PORT", "5007"),
        "label": "Form 16 Premium Agent",
    },
    # Orchestrator starts last — it calls all sub-agents above
    {
        "script": "agents/citizen-agent/agent.py",
        "port": ORCHESTRATOR_PORT,
        "label": "Citizen Agent (Orchestrator)",
    },
]

# Build inter-agent URLs (localhost when running in same Railway service)
INTER_AGENT_ENV = {
    "POLICY_AGENT_URL":      f"http://localhost:{os.environ.get('POLICY_AGENT_PORT', '5001')}",
    "ELIGIBILITY_AGENT_URL": f"http://localhost:{os.environ.get('ELIGIBILITY_AGENT_PORT', '5002')}",
    "MATCHER_AGENT_URL":     f"http://localhost:{os.environ.get('MATCHER_AGENT_PORT', '5003')}",
    "CREDENTIAL_AGENT_URL":  f"http://localhost:{os.environ.get('CREDENTIAL_AGENT_PORT', '5004')}",
    "APPLY_AGENT_URL":       f"http://localhost:{os.environ.get('APPLY_AGENT_PORT', '5005')}",
    "FORM16_AGENT_URL":      f"http://localhost:{os.environ.get('FORM16_AGENT_PORT', '5006')}",
    "FORM16_PREMIUM_AGENT_URL": f"http://localhost:{os.environ.get('FORM16_PREMIUM_AGENT_PORT', '5007')}",
}

processes: list[subprocess.Popen] = []


def start_agents() -> None:
    print("=" * 60)
    print("  POLICY NAVIGATOR — Agent Supervisor")
    print("=" * 60)

    for agent in AGENTS:
        env = os.environ.copy()
        env["PORT"] = str(agent["port"])
        env.update(INTER_AGENT_ENV)  # inject inter-agent URLs into every agent

        script_path = ROOT / agent["script"]
        if not script_path.exists():
            print(f"[Supervisor] WARNING: {agent['script']} not found — skipping")
            continue

        proc = subprocess.Popen(
            [sys.executable, str(script_path)],
            env=env,
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
        processes.append(proc)
        print(f"[Supervisor] Started {agent['label']} (PID {proc.pid}) on port {agent['port']}")

        # Small delay so each agent can bind its port before next one starts
        time.sleep(0.8)

    print("=" * 60)
    print(f"  All {len(processes)} agents running.")
    print(f"  Orchestrator public port: {ORCHESTRATOR_PORT}")
    print("=" * 60)


def restart_agent(agent: dict) -> subprocess.Popen:
    """Restart a single crashed agent."""
    env = os.environ.copy()
    env["PORT"] = str(agent["port"])
    env.update(INTER_AGENT_ENV)
    script_path = ROOT / agent["script"]
    proc = subprocess.Popen(
        [sys.executable, str(script_path)],
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    print(f"[Supervisor] Restarted {agent['label']} (PID {proc.pid}) on port {agent['port']}")
    return proc


def shutdown(signum, frame) -> None:
    print("\n[Supervisor] Signal received — shutting down all agents...")
    for proc in processes:
        try:
            proc.terminate()
        except Exception:
            pass
    for proc in processes:
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
    print("[Supervisor] All agents stopped.")
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    start_agents()

    # Health-check loop — restart any agent that exits unexpectedly
    try:
        while True:
            time.sleep(5)
            for i, proc in enumerate(processes):
                if proc.poll() is not None:
                    agent = AGENTS[i]
                    print(
                        f"[Supervisor] {agent['label']} (PID {proc.pid}) "
                        f"exited with code {proc.returncode}. Restarting..."
                    )
                    time.sleep(2)
                    processes[i] = restart_agent(agent)
    except KeyboardInterrupt:
        shutdown(None, None)
