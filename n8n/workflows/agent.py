from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
import os

load_dotenv()

# Get dynamic port (Render provides this)
port = int(os.environ.get("PORT", 5000))

# Configure agent
config = AgentConfig(
    name="Policy Navigator Agent",
    description="Handles policy eligibility queries",
    mode="webhook",
    webhook_host="0.0.0.0",
    webhook_port=port,
    registry_url="https://registry.zynd.ai",
    api_key=os.environ.get("ZYND_API_KEY")
)

# Initialize agent
agent = ZyndAIAgent(config)

print(f"Agent running with ID: {agent.agent_id}")
print(f"Webhook URL: {agent.webhook_url}")

# Handle incoming messages
def message_handler(message: AgentMessage, topic: str):
    print(f"⚡ Message Received: {message.content}")
    agent.set_response(
        message.message_id,
        f"Policy Navigator received: {message.content}"
    )

agent.add_message_handler(message_handler)