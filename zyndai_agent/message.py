from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class AgentMessage:
    message_id: str = ""
    sender_id: str = ""
    content: Any = None
    metadata: Dict = None
