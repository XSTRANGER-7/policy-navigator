from flask import Flask, request, jsonify
from dotenv import load_dotenv
from pathlib import Path
import os, time, json, uuid

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

agent_id = f"agent:matcher-agent:{uuid.uuid4().hex[:6]}"

app = Flask("Matcher Agent")

CATEGORY_WEIGHTS = {
    "bpl": 10, "disabled": 9, "sc_st": 8, "senior_citizen": 8,
    "women": 7, "farmer": 7, "student": 6, "obc": 5, "general": 3,
}


def llm_why_scheme(citizen: dict, scheme: dict) -> str:
    """Generate a 1-sentence personal reason why this scheme suits this citizen."""
    if not _llm:
        return ""
    try:
        prompt = (
            f"Citizen: age {citizen.get('age')}, income Rs.{citizen.get('income'):,}/yr, "
            f"category '{citizen.get('category')}', state '{citizen.get('state', 'India')}'.\n"
            f"Scheme: '{scheme.get('name')}' - {scheme.get('description', '')}\n"
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


def compute_relevance(citizen: dict, scheme: dict) -> int:
    base = scheme.get("match_score", 50)
    category = str(citizen.get("category", "general")).lower()
    scheme_cat = str(scheme.get("category", "")).lower()

    if category == scheme_cat:
        boost = 25
    elif category in CATEGORY_WEIGHTS:
        boost = CATEGORY_WEIGHTS.get(category, 5)
    else:
        boost = 0

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
    if isinstance(content, dict):
        if "prompt" in content:
            try:
                parsed = json.loads(content["prompt"])
                content = parsed.get("metadata", parsed)
            except Exception:
                pass
    data = content.get("metadata", content)
    return data.get("citizen", {}), data.get("eligible_schemes", [])


@app.get("/health")
def health():
    return jsonify({"status": "ok", "agent": "Matcher Agent", "agent_id": agent_id})


@app.post("/webhook")
@app.post("/webhook/sync")
@app.post("/process")
def process():
    body = request.get_json(force=True, silent=True) or {}
    message_id = body.get("message_id") or str(uuid.uuid4())

    print("[Matcher Agent] Ranking schemes")
    citizen, eligible_schemes = extract_data(body)

    if not eligible_schemes:
        return jsonify({
            "status": "ok",
            "agent": "Matcher Agent",
            "message_id": message_id,
            "response": json.dumps([])
        })

    scored = []
    for scheme in eligible_schemes:
        score = compute_relevance(citizen, scheme)
        scored.append({**scheme, "relevance_score": score})

    ranked = sorted(scored, key=lambda x: x.get("relevance_score", 0), reverse=True)
    for i, s in enumerate(ranked):
        s["rank"] = i + 1

    for s in ranked[:5]:
        why = llm_why_scheme(citizen, s)
        if why:
            s["llm_why"] = why

    print(f"  => Ranked {len(ranked)} schemes")

    return jsonify({
        "status": "ok",
        "agent": "Matcher Agent",
        "message_id": message_id,
        "response": json.dumps(ranked)
    })


if __name__ == "__main__":
    print(f"[Matcher Agent] Running on port {port} | ID: {agent_id}")
    app.run(host="0.0.0.0", port=port, threaded=True)