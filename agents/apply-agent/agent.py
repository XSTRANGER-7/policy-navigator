from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
import os, time, json
from datetime import datetime, timezone

try:
    from openai import OpenAI as _OpenAI
    _openai_available = True
except ImportError:
    _openai_available = False

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5005))
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
_llm = _OpenAI(api_key=OPENAI_API_KEY) if (_openai_available and OPENAI_API_KEY) else None
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


def llm_application_guidance(citizen: dict, scheme_id: str, scheme_name: str, required_docs: list) -> dict:
    """Generate personalized application guidance for this citizen and scheme."""
    if not _llm:
        return {}
    try:
        prompt = (
            f"A citizen wants to apply for the Indian government scheme '{scheme_name}' (ID: {scheme_id}).\n"
            f"Citizen profile: age {citizen.get('age', 'unknown')}, "
            f"income Rs.{citizen.get('income', 0):,}/year, "
            f"category '{citizen.get('category', 'general')}', "
            f"state '{citizen.get('state', 'India')}'.\n"
            f"Required documents: {', '.join(required_docs)}.\n\n"
            f"Return a JSON object with:\n"
            f"  \"guidance\": a 3-4 sentence personalized step-by-step tip for THIS citizen applying for THIS scheme "
            f"(mention their specific situation, e.g. income bracket, category certificate they need, where to apply in their state).\n"
            f"  \"warning\": one sentence about the most common mistake or rejection reason for this type of citizen.\n"
            f"  \"priority_doc\": the single most important document they must arrange first.\n"
            f"Return ONLY valid JSON."
        )
        resp = _llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=350,
            temperature=0.4,
        )
        return json.loads(resp.choices[0].message.content.strip())
    except Exception as e:
        print(f"[Apply Agent][LLM] {e}")
        return {}


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

        # ── LLM: personalized application guidance ────────────────────────
        citizen  = payload.get("citizen", {})
        llm_info = llm_application_guidance(citizen, scheme_id, scheme_name, required)

        agent.set_response(message.message_id, json.dumps({
            "application_id":   str(app_id),
            "scheme_id":        scheme_id,
            "scheme_name":      scheme_name,
            "status":           "started",
            "required_docs":    required,
            "next_steps":       next_steps,
            "steps":            APPLICATION_STEPS,
            "message":          f"Application for {scheme_name} submitted successfully. Track with ID: {str(app_id)[:8]}",
            "saved_to_db":      saved is not None,
            "llm_guidance":     llm_info.get("guidance", ""),
            "llm_warning":      llm_info.get("warning", ""),
            "llm_priority_doc": llm_info.get("priority_doc", ""),
        }))

    else:
        agent.set_response(message.message_id, json.dumps({"error": f"Unknown action: {action}"}))


agent.add_message_handler(message_handler)

while True:
    time.sleep(60)
