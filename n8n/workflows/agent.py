from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, time, json
import requests

env_path = Path(__file__).resolve().parent.parent.parent / "agents" / ".env"
load_dotenv(dotenv_path=env_path, override=False)
load_dotenv(override=False)

port = int(os.environ.get("PORT", 5000))

# On Railway: set these to the public Railway service URLs.
# Locally: defaults to localhost ports.
POLICY_AGENT_URL      = os.environ.get("POLICY_AGENT_URL",      "http://localhost:5001")
ELIGIBILITY_AGENT_URL = os.environ.get("ELIGIBILITY_AGENT_URL", "http://localhost:5002")
MATCHER_AGENT_URL     = os.environ.get("MATCHER_AGENT_URL",     "http://localhost:5003")
CREDENTIAL_AGENT_URL  = os.environ.get("CREDENTIAL_AGENT_URL",  "http://localhost:5004")

config = AgentConfig(
    name="Citizen Agent",
    description="Orchestrates the full policy-eligibility pipeline with partial match fallback",
    capabilities={"ai": ["orchestration"], "protocols": ["http"], "services": ["policy_verification", "eligibility_check", "vc_issuance"]},
    mode="webhook", webhook_host="0.0.0.0", webhook_port=port,
    registry_url="https://registry.zynd.ai", api_key=os.environ.get("ZYND_API_KEY"),
)

agent = ZyndAIAgent(config)
print(f"[Citizen Agent / Orchestrator] Running on port {port}")
print(f"  Policy Agent      → {POLICY_AGENT_URL}")
print(f"  Eligibility Agent → {ELIGIBILITY_AGENT_URL}")
print(f"  Matcher Agent     → {MATCHER_AGENT_URL}")
print(f"  Credential Agent  → {CREDENTIAL_AGENT_URL}")


def call_sub_agent(base_url: str, data: dict, timeout: int = 25) -> any:
    url = base_url.rstrip("/") + "/webhook/sync"
    try:
        resp = requests.post(url, json={"prompt": json.dumps(data), "sender_id": agent.agent_id, "message_type": "query", "metadata": data}, timeout=timeout)
        resp.raise_for_status()
        result = resp.json()
        response = result.get("response", {})
        if isinstance(response, str):
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                return response
        return response
    except requests.exceptions.ConnectionError:
        print(f"  [!] Agent at {url} is unreachable")
        return {"error": f"Agent at {url} unreachable"}
    except Exception as exc:
        print(f"  [!] Sub-agent call failed: {exc}")
        return {"error": str(exc)}


def extract_citizen_profile(content: any) -> dict:
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            return {}
    if isinstance(content, dict):
        if "metadata" in content:
            return content["metadata"]
        if any(k in content for k in ("age", "income", "category", "state")):
            return content
        if "prompt" in content:
            try:
                parsed = json.loads(content["prompt"])
                return parsed.get("metadata", parsed)
            except Exception:
                pass
    return {}


def message_handler(message: AgentMessage, topic: str):
    print("\n" + "=" * 52)
    print("[Citizen Agent] New request received")

    citizen = extract_citizen_profile(message.content)
    print(f"  Profile: {citizen}")

    pipeline = []

    # Step 1 — Fetch all schemes
    print("  [1/4] Fetching schemes from Policy Agent...")
    raw_schemes = call_sub_agent(POLICY_AGENT_URL, {"request": "get_all_schemes"})
    schemes = raw_schemes if isinstance(raw_schemes, list) else raw_schemes.get("schemes", [])
    pipeline.append({"step": "policy_fetch", "count": len(schemes), "ok": bool(schemes)})
    print(f"        Got {len(schemes)} schemes")

    # Step 2 — Evaluate eligibility (returns ALL schemes with eligible flag)
    print("  [2/4] Checking eligibility...")
    raw_all = call_sub_agent(ELIGIBILITY_AGENT_URL, {"citizen": citizen, "schemes": schemes, "return_all": True})
    all_evaluated = raw_all if isinstance(raw_all, list) else raw_all.get("all_evaluated", raw_all.get("eligible", []))
    eligible_schemes  = [s for s in all_evaluated if s.get("eligible")]
    partial_schemes   = sorted([s for s in all_evaluated if not s.get("eligible")], key=lambda x: x.get("match_score", 0), reverse=True)
    pipeline.append({"step": "eligibility_check", "count": len(eligible_schemes), "ok": True})
    print(f"        Eligible: {len(eligible_schemes)}, Partial: {len(partial_schemes)}")

    # Decide what to rank: eligible first; if none use top partial matches
    schemes_to_rank = eligible_schemes if eligible_schemes else partial_schemes[:6]
    using_partial   = len(eligible_schemes) == 0 and bool(partial_schemes)

    # Step 3 — Rank
    print("  [3/4] Ranking schemes...")
    raw_ranked = call_sub_agent(MATCHER_AGENT_URL, {"citizen": citizen, "eligible_schemes": schemes_to_rank})
    ranked_schemes = raw_ranked if isinstance(raw_ranked, list) else raw_ranked.get("ranked", [])
    pipeline.append({"step": "scheme_ranking", "count": len(ranked_schemes), "ok": bool(ranked_schemes)})
    print(f"        Ranked: {len(ranked_schemes)}")

    # Step 4 — VC (only if genuinely eligible)
    vc = None
    if eligible_schemes:
        print("  [4/4] Issuing Verifiable Credential...")
        raw_vc = call_sub_agent(CREDENTIAL_AGENT_URL, {"citizen": citizen, "eligible_schemes": eligible_schemes})
        vc = raw_vc if isinstance(raw_vc, dict) and "credentialSubject" in raw_vc else raw_vc.get("vc") if isinstance(raw_vc, dict) else None
        pipeline.append({"step": "vc_issuance", "count": None, "ok": vc is not None})
    else:
        pipeline.append({"step": "vc_issuance", "count": 0, "ok": False})
        print("  [4/4] No VC — no eligible schemes")

    # Summary
    if using_partial:
        summary = f"No exact matches found. Showing {len(ranked_schemes)} nearest partial matches."
    elif len(eligible_schemes) == 1:
        summary = f"You are eligible for 1 government scheme."
    else:
        summary = f"You are eligible for {len(eligible_schemes)} government schemes."

    result = {
        "status":           "ok",
        "citizen_profile":  citizen,
        "eligible_schemes": eligible_schemes,
        "ranked_schemes":   ranked_schemes,
        "partial_matches":  using_partial,
        "vc":               vc,
        "summary":          summary,
        "total_eligible":   len(eligible_schemes),
        "pipeline":         pipeline,
        "agent_id":         agent.agent_id,
    }
    print("[Citizen Agent] Done.\n")
    agent.set_response(message.message_id, json.dumps(result))


agent.add_message_handler(message_handler)

while True:
    time.sleep(60)
