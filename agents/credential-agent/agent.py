from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
import os
import time

load_dotenv()

port = int(os.environ.get("PORT", 5001))

config = AgentConfig(
    name="Policy Agent",
    description="Provides structured scheme rules",
    capabilities={
        "services": ["policy_rules"],
        "ai": ["policy_lookup"],
        "protocols": ["http"]
    },
    mode="webhook",
    webhook_host="0.0.0.0",
    webhook_port=port,
    registry_url="https://registry.zynd.ai",
    api_key=os.environ.get("ZYND_API_KEY")
)

agent = ZyndAIAgent(config)

def message_handler(message: AgentMessage, topic: str):
    rules = {
        "Youth Scholarship": {
            "income_max": 500000,
            "age_max": 30
        }
    }
    agent.set_response(message.message_id, rules)

agent.add_message_handler(message_handler)

while True:
    time.sleep(60)