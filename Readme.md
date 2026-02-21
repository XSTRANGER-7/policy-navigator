# 🏛️ Policy Navigator — Decentralized Benefit Eligibility Network

## 🚨 Problem

Citizens struggle to access government schemes due to:

- Complex and fragmented policies
- Lack of eligibility clarity
- Manual verification delays
- No portable proof of eligibility
- Data silos across departments

Millions miss benefits they are entitled to.

---

## 💡 Solution

Policy Navigator is a **multi-agent decentralized eligibility network** powered by **Zynd Protocol**.

It:

- Interprets policies automatically
- Verifies citizen eligibility
- Matches the best schemes
- Issues **Verifiable Credentials (VC)**
- Preserves privacy using **DID-based identity**

---

## 🧠 Key Innovation

Each workflow is a **sovereign Zynd agent** with its own DID.

Agents collaborate to:

- Discover policies
- Evaluate eligibility
- Issue trust-backed credentials

No central authority required.

---

## ⚙️ Tech Stack

| Layer | Tech |
|-------|------|
Frontend | Next.js |
Database | Supabase |
Agents | n8n workflows |
Identity | Zynd DID |
Credentials | Zynd VC |
Deployment | Vercel + Railway |

---

## 🤖 Agent Network

1. Citizen Agent → Creates DID & receives profile  
2. Policy Agent → Stores structured scheme rules  
3. Eligibility Agent → Applies rule engine  
4. Matcher Agent → Ranks schemes  
5. Credential Agent → Issues VC  

---

## 🔐 Privacy Model

- DID replaces personal identity
- VC contains only eligibility result
- Income and personal data are not shared
- Citizen controls credential usage

---

## 🧪 Demo Flow

1. Citizen submits profile  
2. Eligibility computed by agent network  
3. VC issued and stored  
4. UI displays **Verified Eligibility Badge**

---

## 🏆 Impact

- Transparent governance
- Faster benefit delivery
- Portable eligibility proof
- Interoperable public services

---

## 🚀 Future Scope

- Bank verification of VC for loans
- NGO integration
- Offline VC wallet
- Bias detection in policies












http://localhost:5678/webhook-test/citizen-agent