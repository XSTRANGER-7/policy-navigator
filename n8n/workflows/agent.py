"""
n8n/workflows/agent.py — Delegation shim
=========================================
This file previously contained a copy of the Citizen Agent (Orchestrator).
It has been consolidated into agents/citizen-agent/agent.py which is the
canonical source of truth.

The supervisor (agents/main.py) starts all agents including the orchestrator.
This shim re-executes the canonical agent so this path still works standalone.
"""
import runpy
from pathlib import Path

_canonical = Path(__file__).resolve().parent.parent.parent / "agents" / "citizen-agent" / "agent.py"
runpy.run_path(str(_canonical), run_name="__main__")
