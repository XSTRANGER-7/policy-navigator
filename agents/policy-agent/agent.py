from zyndai_agent.agent import AgentConfig, ZyndAIAgent
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
