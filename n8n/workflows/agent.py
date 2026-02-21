from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
import os
import time


load_dotenv()

# Configure your agent
agent_config = AgentConfig(
    name="My Simple Agent",
    description="Test agent running workflow",
    capabilities={
        "ai": ["nlp"],
        "protocols": ["http"],
        "services": ["general"]
    },
    webhook_host="0.0.0.0",
 

port = int(os.environ.get("PORT", 5000))

config = AgentConfig(
    name="Policy Navigator Agent",
    description="Handles policy eligibility queries",
    mode="webhook",
    webhook_port=port
)
    registry_url="https://registry.zynd.ai",
    api_key=os.environ["ZYND_API_KEY"]
)

# Initialize agent (auto-provisions identity on first run)
agent = ZyndAIAgent(agent_config=agent_config)

print(f"Agent running with ID: {agent.agent_id}")
print(f"Webhook URL: {agent.webhook_url}")

# Handler for incoming messages
def message_handler(message: AgentMessage, topic: str):
    print(f"⚡ Message Received: {message.content}")
    agent.set_response(message.message_id, f"Got your message: {message.content}")

agent.add_message_handler(message_handler)

# Keep the agent alive
while True:
    time.sleep(1)