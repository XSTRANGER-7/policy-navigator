"""Helper script to write agent files — run once then delete."""
import os

# ─── Policy Agent ─────────────────────────────────────────────────────────────
POLICY_AGENT = r'''from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, time, json

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5001))
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

config = AgentConfig(
    name="Policy Agent",
    description="Provides the complete government scheme database with eligibility rules",
    capabilities={"services": ["policy_rules", "scheme_database"], "ai": ["policy_lookup"], "protocols": ["http"]},
    mode="webhook", webhook_host="0.0.0.0", webhook_port=port,
    registry_url="https://registry.zynd.ai", api_key=os.environ.get("ZYND_API_KEY")
)
agent = ZyndAIAgent(config)
print(f"[Policy Agent] Running on port {port} | ID: {agent.agent_id}")

# Hardcoded fallback (always up-to-date)
SCHEMES_FALLBACK = [
    {"id": "pm_kisan", "name": "PM-KISAN", "category": "farmer",
     "description": "Direct income support of Rs.6,000/year to small and marginal farmer families.",
     "benefits": "Rs.6,000/year in 3 equal installments of Rs.2,000",
     "eligibility_text": "Land-owning farmer families with cultivable land.",
     "rules": {"categories": ["farmer"], "income_max": 200000, "age_min": 18, "age_max": 70},
     "ministry": "Ministry of Agriculture and Farmers Welfare", "official_url": "https://pmkisan.gov.in"},
    {"id": "ayushman_bharat", "name": "Ayushman Bharat (PM-JAY)", "category": "health",
     "description": "Health insurance cover of Rs.5 lakh per family per year for hospitalization.",
     "benefits": "Rs.5 lakh/year health insurance cover",
     "eligibility_text": "BPL and low-income families.",
     "rules": {"categories": ["bpl", "general", "sc_st", "obc", "farmer", "disabled", "women"], "income_max": 300000, "age_min": 0, "age_max": 120},
     "ministry": "Ministry of Health and Family Welfare", "official_url": "https://pmjay.gov.in"},
    {"id": "pm_ujjwala", "name": "PM Ujjwala Yojana", "category": "women",
     "description": "Free LPG connections to women from BPL households for clean cooking fuel.",
     "benefits": "Free LPG connection + first refill cylinder",
     "eligibility_text": "Women from BPL households without existing LPG connection.",
     "rules": {"categories": ["women", "bpl"], "income_max": 200000, "age_min": 18, "age_max": 60},
     "ministry": "Ministry of Petroleum and Natural Gas", "official_url": "https://pmuy.gov.in"},
    {"id": "post_matric_scholarship", "name": "Post Matric Scholarship (SC/ST/OBC)", "category": "student",
     "description": "Financial assistance for SC/ST/OBC students in post-matriculation education.",
     "benefits": "Tuition fee reimbursement + monthly maintenance allowance",
     "eligibility_text": "SC/ST/OBC students with family income below Rs.2.5 lakh/year.",
     "rules": {"categories": ["student", "sc_st", "obc"], "income_max": 250000, "age_min": 15, "age_max": 30},
     "ministry": "Ministry of Social Justice and Empowerment", "official_url": "https://scholarships.gov.in"},
    {"id": "youth_scholarship", "name": "Youth Scholarship Scheme", "category": "student",
     "description": "Merit-cum-means scholarship for economically weaker students.",
     "benefits": "Rs.12,000/year scholarship stipend",
     "eligibility_text": "Young students with annual family income below Rs.5 lakh.",
     "rules": {"categories": ["student", "general", "obc", "sc_st", "bpl"], "income_max": 500000, "age_min": 16, "age_max": 30},
     "ministry": "Ministry of Education", "official_url": "https://scholarships.gov.in"},
    {"id": "mnrega", "name": "MNREGA", "category": "general",
     "description": "Guaranteed 100 days of wage employment per year to rural household adults.",
     "benefits": "100 days guaranteed employment at minimum wage",
     "eligibility_text": "Any adult member of a rural household.",
     "rules": {"categories": ["general", "farmer", "bpl", "sc_st", "obc", "women", "disabled"], "income_max": 300000, "age_min": 18, "age_max": 80},
     "ministry": "Ministry of Rural Development", "official_url": "https://nrega.nic.in"},
    {"id": "mudra_loan", "name": "MUDRA Loan (PM Mudra Yojana)", "category": "general",
     "description": "Collateral-free loans Rs.50,000 to Rs.10 lakh for small businesses.",
     "benefits": "Loans up to Rs.10 lakh at subsidized interest rates",
     "eligibility_text": "Any Indian citizen with a non-farm business plan.",
     "rules": {"categories": ["general", "obc", "sc_st", "women", "farmer"], "income_max": 1500000, "age_min": 18, "age_max": 65},
     "ministry": "Ministry of Finance", "official_url": "https://mudra.org.in"},
    {"id": "disability_pension", "name": "Indira Gandhi National Disability Pension", "category": "disabled",
     "description": "Monthly pension for persons with severe disabilities living below poverty line.",
     "benefits": "Rs.300-500/month pension",
     "eligibility_text": "BPL persons with 80%+ disability, aged 18-79.",
     "rules": {"categories": ["disabled", "bpl"], "income_max": 150000, "age_min": 18, "age_max": 79},
     "ministry": "Ministry of Rural Development", "official_url": "https://nsap.nic.in"},
    {"id": "senior_pension", "name": "Indira Gandhi Old Age Pension", "category": "senior_citizen",
     "description": "Monthly pension for destitute elderly persons aged 60 and above.",
     "benefits": "Rs.200-500/month depending on age",
     "eligibility_text": "BPL individuals aged 60 years and above.",
     "rules": {"categories": ["senior_citizen", "bpl", "general"], "income_max": 150000, "age_min": 60, "age_max": 120},
     "ministry": "Ministry of Rural Development", "official_url": "https://nsap.nic.in"},
    {"id": "pm_awas_gramin", "name": "PM Awas Yojana (Gramin)", "category": "bpl",
     "description": "Financial assistance for construction of pucca houses for rural BPL families.",
     "benefits": "Rs.1.2-1.5 lakh financial assistance for house construction",
     "eligibility_text": "Homeless or kutcha-house BPL families in rural areas.",
     "rules": {"categories": ["bpl", "sc_st", "general", "farmer"], "income_max": 200000, "age_min": 18, "age_max": 80},
     "ministry": "Ministry of Rural Development", "official_url": "https://pmayg.nic.in"},
    {"id": "standup_india", "name": "Stand-Up India", "category": "women",
     "description": "Bank loans Rs.10 lakh to Rs.1 crore for SC/ST and women entrepreneurs.",
     "benefits": "Loans Rs.10 lakh - Rs.1 crore for greenfield enterprises",
     "eligibility_text": "SC/ST or women entrepreneurs above 18 years.",
     "rules": {"categories": ["women", "sc_st"], "income_max": 5000000, "age_min": 18, "age_max": 65},
     "ministry": "Ministry of Finance", "official_url": "https://standupmitra.in"},
    {"id": "nps", "name": "National Pension Scheme (NPS)", "category": "general",
     "description": "Contributory pension system for organized and unorganized sector workers.",
     "benefits": "Market-linked pension corpus + tax benefits",
     "eligibility_text": "Indian citizen aged 18-70 years.",
     "rules": {"categories": ["general", "farmer", "women", "obc", "sc_st"], "income_max": 10000000, "age_min": 18, "age_max": 70},
     "ministry": "Ministry of Finance / PFRDA", "official_url": "https://npscra.nsdl.co.in"},
]


def fetch_schemes_from_supabase() -> list:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        result = sb.table("schemes").select("*").eq("is_active", True).execute()
        rows = result.data or []
        if not rows:
            return []
        normalized = []
        for row in rows:
            rules = row.get("rules", {})
            if isinstance(rules, str):
                try:
                    rules = json.loads(rules)
                except Exception:
                    rules = {}
            normalized.append({
                "id": row.get("id"), "name": row.get("name"), "category": row.get("category"),
                "description": row.get("description"), "benefits": row.get("benefits"),
                "eligibility_text": row.get("eligibility_text"), "rules": rules,
                "ministry": row.get("ministry", ""), "official_url": row.get("official_url", ""),
            })
        print(f"[Policy Agent] Loaded {len(normalized)} schemes from Supabase")
        return normalized
    except Exception as e:
        print(f"[Policy Agent] Supabase unavailable, using fallback: {e}")
        return []


def message_handler(message: AgentMessage, topic: str):
    schemes = fetch_schemes_from_supabase()
    if not schemes:
        print(f"[Policy Agent] Using hardcoded fallback ({len(SCHEMES_FALLBACK)} schemes)")
        schemes = SCHEMES_FALLBACK
    agent.set_response(message.message_id, json.dumps(schemes))


agent.add_message_handler(message_handler)

while True:
    time.sleep(60)
'''

# ─── Apply Agent ────────────────────────────────────────────────────────────
APPLY_AGENT = r'''from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, time, json
from datetime import datetime, timezone

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5005))
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

config = AgentConfig(
    name="Apply Agent",
    description="Handles scheme applications: validates docs, saves to Supabase, tracks progress",
    capabilities={"services": ["application_processing", "doc_validation"], "ai": ["form_assist"], "protocols": ["http"]},
    mode="webhook", webhook_host="0.0.0.0", webhook_port=port,
    registry_url="https://registry.zynd.ai", api_key=os.environ.get("ZYND_API_KEY")
)
agent = ZyndAIAgent(config)
print(f"[Apply Agent] Running on port {port} | ID: {agent.agent_id}")

# Minimum required docs per scheme
SCHEME_DOCS = {
    "pm_kisan":               ["Aadhaar Card", "Land Records (Khasra/Khatauni)", "Bank Account linked to Aadhaar"],
    "ayushman_bharat":        ["Aadhaar Card", "Ration Card or SECC Family ID"],
    "pm_ujjwala":             ["Aadhaar Card", "BPL Ration Card", "Passport Photo"],
    "post_matric_scholarship":["Aadhaar Card", "Caste Certificate", "Previous Marksheet", "Income Certificate", "Bank Account"],
    "youth_scholarship":      ["Aadhaar Card", "Last Marksheet (min 60%)", "Income Certificate", "Bank Account"],
    "mnrega":                 ["Aadhaar Card", "Job Card (if available)"],
    "mudra_loan":             ["Aadhaar Card", "PAN Card", "Business Plan / Project Report", "Bank Statement (6 months)"],
    "disability_pension":     ["Aadhaar Card", "Disability Certificate (80%+)", "BPL Card", "Bank Account"],
    "senior_pension":         ["Aadhaar Card", "Age Proof (60+ years)", "BPL Certificate", "Bank Account"],
    "pm_awas_gramin":         ["Aadhaar Card", "BPL Ration Card", "Land Rights Certificate"],
    "standup_india":          ["Aadhaar Card", "SC/ST Certificate or Gender Proof", "Business Plan", "Bank Account"],
    "nps":                    ["Aadhaar Card", "PAN Card", "Bank Account"],
}
CATEGORY_DOCS = {
    "farmer":        ["Aadhaar Card", "Land Records", "Bank Account"],
    "student":       ["Aadhaar Card", "Last Marksheet", "Income Certificate"],
    "bpl":           ["BPL Ration Card", "Aadhaar Card", "Income Certificate"],
    "women":         ["Aadhaar Card", "Address Proof", "Bank Account"],
    "disabled":      ["Aadhaar Card", "Disability Certificate", "Income Certificate"],
    "senior_citizen":["Aadhaar Card", "Age Proof", "BPL Certificate"],
    "sc_st":         ["Aadhaar Card", "Caste Certificate", "Income Certificate"],
    "obc":           ["Aadhaar Card", "OBC Certificate", "Income Certificate"],
    "general":       ["Aadhaar Card", "Income Certificate", "Bank Account"],
}

APPLICATION_STEPS = [
    {"step": "started",              "label": "Application Started",   "description": "Your application has been created"},
    {"step": "documents_submitted",  "label": "Documents Submitted",   "description": "Documents have been submitted for review"},
    {"step": "under_review",         "label": "Under Review",          "description": "Officials are verifying your application"},
    {"step": "approved",             "label": "Approved",              "description": "Your application has been approved"},
]


def get_required_docs(scheme_id: str, category: str = "general") -> list:
    return SCHEME_DOCS.get(scheme_id, CATEGORY_DOCS.get(category, CATEGORY_DOCS["general"]))


def save_application(data: dict) -> dict | None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        row = {
            "citizen_id":   data.get("citizen_id"),
            "user_id":      data.get("user_id"),
            "scheme_id":    data.get("scheme_id"),
            "scheme_name":  data.get("scheme_name"),
            "status":       "started",
            "docs":         json.dumps(data.get("docs", {})),
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
        result = sb.table("applications").insert(row).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"[Apply Agent] Supabase save error: {e}")
        return None


def extract_payload(content) -> dict:
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            return {}
    if isinstance(content, dict):
        return content.get("metadata", content)
    return {}


def message_handler(message: AgentMessage, topic: str):
    print("[Apply Agent] Processing application request")
    payload = extract_payload(message.content)

    action = payload.get("action", "get_docs")

    if action == "get_docs":
        # Return required docs for a scheme
        scheme_id = payload.get("scheme_id", "")
        category  = payload.get("category", "general")
        docs      = get_required_docs(scheme_id, category)
        agent.set_response(message.message_id, json.dumps({
            "scheme_id":    scheme_id,
            "required_docs": docs,
            "steps":        APPLICATION_STEPS,
        }))

    elif action == "submit":
        # Save application
        scheme_id   = payload.get("scheme_id", "unknown")
        scheme_name = payload.get("scheme_name", "Unknown Scheme")
        saved       = save_application(payload)
        app_id      = saved["id"] if saved else f"APP-{abs(hash(scheme_id + str(time.time())))}"[:16]
        required    = get_required_docs(scheme_id, payload.get("category", "general"))

        next_steps = [
            f"Gather these documents: {', '.join(required[:3])}{'...' if len(required) > 3 else ''}",
            "Visit your nearest Common Service Centre (CSC) or apply online",
            "Track your application status using your Application ID",
        ]

        agent.set_response(message.message_id, json.dumps({
            "application_id": str(app_id),
            "scheme_id":      scheme_id,
            "scheme_name":    scheme_name,
            "status":         "started",
            "required_docs":  required,
            "next_steps":     next_steps,
            "steps":          APPLICATION_STEPS,
            "message":        f"Application for {scheme_name} submitted successfully. Track with ID: {str(app_id)[:8]}",
            "saved_to_db":    saved is not None,
        }))

    else:
        agent.set_response(message.message_id, json.dumps({"error": f"Unknown action: {action}"}))


agent.add_message_handler(message_handler)

while True:
    time.sleep(60)
'''

# ─── Orchestrator with partial matches ────────────────────────────────────────
ORCHESTRATOR = r'''from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, time, json
import requests

env_path = Path(__file__).resolve().parent.parent.parent / "agents" / ".env"
load_dotenv(dotenv_path=env_path, override=False)
load_dotenv(override=False)

port                   = int(os.environ.get("PORT",                   5000))
POLICY_AGENT_PORT      = int(os.environ.get("POLICY_AGENT_PORT",      5001))
ELIGIBILITY_AGENT_PORT = int(os.environ.get("ELIGIBILITY_AGENT_PORT", 5002))
MATCHER_AGENT_PORT     = int(os.environ.get("MATCHER_AGENT_PORT",     5003))
CREDENTIAL_AGENT_PORT  = int(os.environ.get("CREDENTIAL_AGENT_PORT",  5004))

config = AgentConfig(
    name="Citizen Agent",
    description="Orchestrates the full policy-eligibility pipeline with partial match fallback",
    capabilities={"ai": ["orchestration"], "protocols": ["http"], "services": ["policy_verification", "eligibility_check", "vc_issuance"]},
    mode="webhook", webhook_host="0.0.0.0", webhook_port=port,
    registry_url="https://registry.zynd.ai", api_key=os.environ.get("ZYND_API_KEY"),
)

agent = ZyndAIAgent(config)
print(f"[Citizen Agent / Orchestrator] Running on port {port}")


def call_sub_agent(port_num: int, data: dict, timeout: int = 25) -> any:
    url = f"http://localhost:{port_num}/webhook/sync"
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
        print(f"  [!] Agent on port {port_num} is unreachable")
        return {"error": f"Agent on port {port_num} unreachable"}
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
    raw_schemes = call_sub_agent(POLICY_AGENT_PORT, {"request": "get_all_schemes"})
    schemes = raw_schemes if isinstance(raw_schemes, list) else raw_schemes.get("schemes", [])
    pipeline.append({"step": "policy_fetch", "count": len(schemes), "ok": bool(schemes)})
    print(f"        Got {len(schemes)} schemes")

    # Step 2 — Evaluate eligibility (returns ALL schemes with eligible flag)
    print("  [2/4] Checking eligibility...")
    raw_all = call_sub_agent(ELIGIBILITY_AGENT_PORT, {"citizen": citizen, "schemes": schemes, "return_all": True})
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
    raw_ranked = call_sub_agent(MATCHER_AGENT_PORT, {"citizen": citizen, "eligible_schemes": schemes_to_rank})
    ranked_schemes = raw_ranked if isinstance(raw_ranked, list) else raw_ranked.get("ranked", [])
    pipeline.append({"step": "scheme_ranking", "count": len(ranked_schemes), "ok": bool(ranked_schemes)})
    print(f"        Ranked: {len(ranked_schemes)}")

    # Step 4 — VC (only if genuinely eligible)
    vc = None
    if eligible_schemes:
        print("  [4/4] Issuing Verifiable Credential...")
        raw_vc = call_sub_agent(CREDENTIAL_AGENT_PORT, {"citizen": citizen, "eligible_schemes": eligible_schemes})
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
'''

# Write files
os.makedirs("agents/policy-agent",  exist_ok=True)
os.makedirs("agents/apply-agent",   exist_ok=True)
os.makedirs("n8n/workflows",         exist_ok=True)

with open("agents/policy-agent/agent.py",  "w", encoding="utf-8") as f: f.write(POLICY_AGENT)
with open("agents/apply-agent/agent.py",   "w", encoding="utf-8") as f: f.write(APPLY_AGENT)
with open("n8n/workflows/agent.py",        "w", encoding="utf-8") as f: f.write(ORCHESTRATOR)
with open("agents/citizen-agent/agent.py", "w", encoding="utf-8") as f: f.write(ORCHESTRATOR)

ELIGIBILITY_PATCH = '''
def message_handler(message: AgentMessage, topic: str):
    print("[Eligibility Agent] Evaluating eligibility")
    citizen, schemes = extract_data(message.content)
    data_raw = message.content
    if isinstance(data_raw, str):
        try: data_raw = json.loads(data_raw)
        except: pass
    if isinstance(data_raw, dict):
        data_raw = data_raw.get("metadata", data_raw)
    return_all = data_raw.get("return_all", False) if isinstance(data_raw, dict) else False

    if not schemes:
        agent.set_response(message.message_id, json.dumps([]))
        return

    results = [check_scheme_eligibility(citizen, s) for s in schemes]
    eligible = [r for r in results if r["eligible"]]
    print(f"[Eligibility Agent] {len(eligible)}/{len(results)} eligible")

    if return_all:
        agent.set_response(message.message_id, json.dumps(results))
    else:
        agent.set_response(message.message_id, json.dumps(eligible))
'''
# Read existing eligibility agent and patch its message_handler
with open("agents/eligibility-agent/agent.py", "r", encoding="utf-8") as f:
    elig = f.read()
# Replace old message_handler
old_handler_start = "\ndef message_handler(message: AgentMessage, topic: str):"
idx = elig.find(old_handler_start)
if idx != -1:
    elig = elig[:idx] + ELIGIBILITY_PATCH
    with open("agents/eligibility-agent/agent.py", "w", encoding="utf-8") as f:
        f.write(elig)
    print("Eligibility agent patched.")
else:
    print("Could not find handler to patch in eligibility agent.")

print("All agent files written successfully.")
