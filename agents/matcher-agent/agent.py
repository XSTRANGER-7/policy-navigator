from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, time, json

try:
    from openai import OpenAI as _OpenAI
    _openai_available = True
except ImportError:
    _openai_available = False

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5003))
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
_llm = _OpenAI(api_key=OPENAI_API_KEY) if (_openai_available and OPENAI_API_KEY) else None


def llm_why_scheme(citizen: dict, scheme: dict) -> str:
    """Generate a 1-sentence personal reason why this scheme suits this citizen."""
    if not _llm:
        return ""
    try:
        prompt = (
            f"Citizen: age {citizen.get('age')}, income Rs.{citizen.get('income'):,}/yr, "
            f"category '{citizen.get('category')}', state '{citizen.get('state', 'India')}'.\n"
            f"Scheme: '{scheme.get('name')}' — {scheme.get('description', '')}\n"
            f"Benefits: {scheme.get('benefits', '')}\n\n"
            f"Write exactly ONE plain-English sentence explaining why THIS scheme is a strong match "
            f"for THIS specific citizen. Be specific about their profile. No preamble."
        )
        resp = _llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.5,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Matcher Agent][LLM] {e}")
        return ""

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

    # ── LLM: "why this scheme fits you" for top 5 ──────────────────────────
    for s in ranked[:5]:
        why = llm_why_scheme(citizen, s)
        if why:
            s["llm_why"] = why

    print(f"  => Ranked {len(ranked)} schemes")
    agent.set_response(message.message_id, json.dumps(ranked))


agent.add_message_handler(message_handler)

while True:
    time.sleep(60)