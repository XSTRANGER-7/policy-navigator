from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, time, json

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5003))

config = AgentConfig(
    name="Matcher Agent",
    description="Ranks eligible schemes by relevance and benefit value for each citizen profile",
    capabilities={
        "services": ["scheme_ranking"],
        "ai": ["relevance_scoring"],
        "protocols": ["http"]
    },
    mode="webhook",
    webhook_host="0.0.0.0",
    webhook_port=port,
    registry_url="https://registry.zynd.ai",
    api_key=os.environ.get("ZYND_API_KEY")
)

agent = ZyndAIAgent(config)
print(f"[Matcher Agent] Running on port {port} | ID: {agent.agent_id}")

# Category priority weights — higher = more priority
CATEGORY_WEIGHTS = {
    "bpl": 10, "disabled": 9, "sc_st": 8, "senior_citizen": 8,
    "women": 7, "farmer": 7, "student": 6, "obc": 5, "general": 3,
}


def compute_relevance(citizen: dict, scheme: dict) -> int:
    base = scheme.get("match_score", 50)
    category = str(citizen.get("category", "general")).lower()
    scheme_cat = str(scheme.get("category", "")).lower()

    # Exact primary category match gets big boost
    if category == scheme_cat:
        boost = 25
    elif category in CATEGORY_WEIGHTS:
        boost = CATEGORY_WEIGHTS.get(category, 5)
    else:
        boost = 0

    # Boost for very low income relative to limit
    income = int(citizen.get("income", 0))
    income_ratio_boost = 0
    if income < 150000:
        income_ratio_boost = 5
    elif income < 300000:
        income_ratio_boost = 3

    return min(100, base + boost + income_ratio_boost)


def extract_data(content):
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            return {}, []
    data = content.get("metadata", content)
    return data.get("citizen", {}), data.get("eligible_schemes", [])


def message_handler(message: AgentMessage, topic: str):
    print("[Matcher Agent] Ranking schemes")
    citizen, eligible_schemes = extract_data(message.content)

    if not eligible_schemes:
        agent.set_response(message.message_id, json.dumps([]))
        return

    scored = []
    for scheme in eligible_schemes:
        score = compute_relevance(citizen, scheme)
        scored.append({**scheme, "relevance_score": score})

    ranked = sorted(scored, key=lambda x: x.get("relevance_score", 0), reverse=True)
    for i, s in enumerate(ranked):
        s["rank"] = i + 1

    print(f"  => Ranked {len(ranked)} schemes")
    agent.set_response(message.message_id, json.dumps(ranked))


agent.add_message_handler(message_handler)

while True:
    time.sleep(60)