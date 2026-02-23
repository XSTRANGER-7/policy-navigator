from zyndai_agent.agent import AgentConfig, ZyndAIAgent
from zyndai_agent.message import AgentMessage
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os, time, json, hashlib

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5004))

config = AgentConfig(
    name="Credential Agent",
    description="Issues W3C-compliant Verifiable Credentials for citizen eligibility",
    capabilities={
        "services": ["vc_issuance", "did_verification"],
        "ai": [],
        "protocols": ["http"]
    },
    mode="webhook",
    webhook_host="0.0.0.0",
    webhook_port=port,
    registry_url="https://registry.zynd.ai",
    api_key=os.environ.get("ZYND_API_KEY")
)

agent = ZyndAIAgent(config)
print(f"[Credential Agent] Running on port {port} | ID: {agent.agent_id}")


def generate_citizen_did(citizen: dict) -> str:
    seed = f"{citizen.get('email', '')}{citizen.get('age', '')}{citizen.get('state', '')}{citizen.get('category', '')}"
    h = hashlib.sha256(seed.encode()).hexdigest()[:32]
    return f"did:key:z{h}"


def extract_data(content):
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            return {}, []
    data = content.get("metadata", content)
    citizen = data.get("citizen", {})
    # Accept both 'matched_schemes' (legacy) and 'eligible_schemes' (current orchestrator)
    schemes = data.get("matched_schemes") or data.get("eligible_schemes") or []
    return citizen, schemes


def message_handler(message: AgentMessage, topic: str):
    print("[Credential Agent] Issuing VC")
    citizen, matched_schemes = extract_data(message.content)

    now = datetime.now(timezone.utc)
    issued_at = now.isoformat()
    expires_at = (now + timedelta(days=365)).isoformat()
    citizen_did = generate_citizen_did(citizen)
    vc_id = hashlib.sha256(citizen_did.encode()).hexdigest()[:16]

    scheme_refs = [
        {
            "id": s.get("scheme_id") or s.get("id"),
            "name": s.get("name"),
            "benefits": s.get("benefits"),
            "rank": s.get("rank", 0),
            "score": s.get("relevance_score", 0),
        }
        for s in matched_schemes
    ]

    income = int(citizen.get("income", 0))
    income_bracket = "low" if income < 200000 else "medium" if income < 600000 else "high"

    vc = {
        "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://policy-navigator.ai/credentials/v1",
        ],
        "type": ["VerifiableCredential", "EligibilityCredential"],
        "id": f"urn:uuid:{vc_id}",
        "issuer": {
            "id": agent.agent_id,
            "name": "Policy Navigator Credential Agent",
        },
        "issuanceDate": issued_at,
        "expirationDate": expires_at,
        "credentialSubject": {
            "id": citizen_did,
            "profile": {
                "age": citizen.get("age"),
                "state": citizen.get("state"),
                "category": citizen.get("category"),
                "income_bracket": income_bracket,
            },
            "eligibility": {
                "verified": True,
                "totalSchemes": len(matched_schemes),
                "schemes": scheme_refs,
            },
        },
        "proof": {
            "type": "ZyndAISignature2024",
            "created": issued_at,
            "verificationMethod": f"{agent.agent_id}#key-1",
            "proofPurpose": "assertionMethod",
        },
    }

    print(f"  => VC issued for {citizen_did[:30]}... | {len(matched_schemes)} schemes")
    agent.set_response(message.message_id, json.dumps(vc))


agent.add_message_handler(message_handler)

while True:
    time.sleep(60)