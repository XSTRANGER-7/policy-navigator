"""Minimal stub of zyndai_agent for deployment when upstream package is unavailable.
This provides tiny no-op classes used by the agents so they can start.
Replace with the real `zyndai-agent` package in production.
"""
from .agent import AgentConfig, ZyndAIAgent
from .message import AgentMessage

__all__ = ["AgentConfig", "ZyndAIAgent", "AgentMessage"]
