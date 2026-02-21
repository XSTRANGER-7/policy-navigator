from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
import os
import time

# 🔥 Load environment variables from .env
load_dotenv()

# 🔎 Debug check (remove later if you want)
print("ZYND_API_KEY loaded:", os.environ.get("ZYND_API_KEY") is not None)
print("OPENAI_API_KEY loaded:", os.environ.get("OPENAI_API_KEY") is not None)

# 🌐 Use dynamic port (required for Render deployment)
port = int(os.environ.get("PORT", 5000))

# 🏛️ Configure Eligibility Agent
config = AgentConfig(
    name="Eligibility Agent",
    description="Evaluates citizen eligibility for schemes",
    capabilities={
        "services": ["eligibility_check"],
        "ai": ["rule_engine"],
        "protocols": ["http"]
    },
    mode="webhook",
    webhook_host="0.0.0.0",
    webhook_port=port,
    registry_url="https://registry.zynd.ai",
    api_key=os.environ.get("ZYND_API_KEY")
)

# 🤖 Initialize Agent
agent = ZyndAIAgent(config)

print("\nEligibility Agent Started")
print("Agent ID:", agent.agent_id)
print("Webhook URL:", agent.webhook_url)
print("--------------------------------------------------")

# 📩 Message Handler
def message_handler(message: AgentMessage, topic: str):
    print("Received message:", message.content)

    profile = message.content

    # 🧠 SIMPLE RULE ENGINE
    income = profile.get("income", 0)
    age = profile.get("age", 0)

    if income < 500000 and age < 30:
        result = {
            "eligible": True,
            "scheme": "Youth Scholarship"
        }
    else:
        result = {
            "eligible": False,
            "reason": "Income/Age criteria not met"
        }

    # 🔁 Send response back
    agent.set_response(message.message_id, result)

# 🧩 Register handler
agent.add_message_handler(message_handler)

# 🔄 Keep process alive (important for cloud deployment)
while True:
    time.sleep(60)