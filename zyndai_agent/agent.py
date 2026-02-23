from dataclasses import dataclass, field
from typing import Any, Dict, Callable, Optional
import uuid


@dataclass
class AgentConfig:
    name: str = "StubAgent"
    description: str = ""
    capabilities: Dict = field(default_factory=dict)
    mode: str = "webhook"
    webhook_host: str = "0.0.0.0"
    webhook_port: int = 5000
    registry_url: Optional[str] = None
    api_key: Optional[str] = None


class ZyndAIAgent:
    """Very small stub of the real ZyndAIAgent.
    It provides only the minimal surface the agents in this repo use:
      - `agent_id` string
      - `add_message_handler(handler)` (stores handler)
      - `set_response(message_id, response)` (prints)
    This is a compatibility shim — replace with upstream package.
    """

    def __init__(self, agent_config: AgentConfig = None, **kwargs):
        cfg = agent_config or AgentConfig()
        self.config = cfg
        self.agent_id = f"agent:{uuid.uuid4().hex[:8]}"
        self._handler: Optional[Callable] = None

    def add_message_handler(self, handler: Callable[[Any, str], None]):
        self._handler = handler

    def set_response(self, message_id: str, response: Any):
        print(f"[ZyndAIAgent stub] set_response for {message_id}: {response}")
