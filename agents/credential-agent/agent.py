from flask import Flask, request, jsonify
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os, time, json, hashlib, uuid

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.environ.get("PORT", 5004))
agent_id = f"agent:credential-agent:{uuid.uuid4().hex[:6]}"

app = Flask("Credential Agent")


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
    if isinstance(content, dict):
        if "prompt" in content:
            try:
                parsed = json.loads(content["prompt"])
                content = parsed.get("metadata", parsed)
            except Exception:
                pass
    data = content.get("metadata", content)
    citizen = data.get("citizen", {})
    schemes = data.get("matched_schemes") or data.get("eligible_schemes") or []
    return citizen, schemes


@app.get("/health")
def health():
    return jsonify({"status": "ok", "agent": "Credential Agent", "agent_id": agent_id})


@app.post("/webhook")
@app.post("/webhook/sync")
@app.post("/process")
def process():
    body = request.get_json(force=True, silent=True) or {}
    message_id = body.get("message_id") or str(uuid.uuid4())

    print("[Credential Agent] Issuing VC")
    citizen, matched_schemes = extract_data(body)

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
            "id": agent_id,
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
            "verificationMethod": f"{agent_id}#key-1",
            "proofPurpose": "assertionMethod",
        },
    }

    print(f"  => VC issued for {citizen_did[:30]}... | {len(matched_schemes)} schemes")

    return jsonify({
        "status": "ok",
        "agent": "Credential Agent",
        "message_id": message_id,
        "response": json.dumps(vc)
    })


if __name__ == "__main__":
    print(f"[Credential Agent] Running on port {port} | ID: {agent_id}")
    app.run(host="0.0.0.0", port=port, threaded=True)