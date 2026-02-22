# CIVIS AI — Policy Navigator

**A decentralized, multi-agent benefit eligibility network for Indian citizens.**  
Built on [ZyndAI Protocol](https://zynd.ai) with a Next.js 16 frontend, 8 Python AI agents, Supabase database, and x402 micropayments on Base.

---

## Table of Contents

1. [Problem](#problem)
2. [What It Does](#what-it-does)
3. [Architecture Overview](#architecture-overview)
4. [Tech Stack](#tech-stack)
5. [Agent Network](#agent-network)
6. [Frontend — Pages & Components](#frontend--pages--components)
7. [API Routes](#api-routes)
8. [Database Schema](#database-schema)
9. [x402 Micropayments](#x402-micropayments)
10. [Form 16 Tax Assistant](#form-16-tax-assistant)
11. [Identity & Credentials (DID / VC)](#identity--credentials-did--vc)
12. [Project Structure](#project-structure)
13. [Environment Variables](#environment-variables)
14. [Running Locally](#running-locally)
15. [Deployment](#deployment)
16. [Future Scope](#future-scope)

---

## Problem

Millions of Indian citizens miss government benefits they are entitled to because:

- Schemes are scattered across dozens of portals
- Eligibility criteria are buried in dense policy documents
- Verification is manual, slow, and paper-heavy
- There is no portable proof of verified eligibility that can be reused
- Income and personal data must be re-submitted to every agency

---

## What It Does

CIVIS AI is a **multi-agent eligibility discovery engine**. A citizen submits a single profile and the agent network:

1. Looks up every applicable government scheme from the live database
2. Runs a multi-criteria rule engine to determine eligibility for each scheme
3. Ranks and scores matched schemes
4. Issues a **Verifiable Credential (VC)** — a tamper-proof, portable eligibility badge
5. Stores the citizen's DID-bound profile in Supabase
6. Additionally provides a full **Form 16 / Income Tax assistant** for salaried employees, with paid premium tax reports via **x402 micropayments**

---

## Architecture Overview

```
Browser (Next.js 16)
      │
      ├─ /api/* (Next.js App Router API routes)
      │       │
      │       ├─ ──> Orchestrator Agent  (port 5000)  [n8n/workflows/agent.py]
      │       │           │
      │       │           ├─> Policy Agent      (5001)  scheme database + Supabase
      │       │           ├─> Eligibility Agent (5002)  rule engine
      │       │           ├─> Matcher Agent     (5003)  scoring + ranking
      │       │           └─> Credential Agent  (5004)  W3C VC issuance
      │       │
      │       ├─ ──> Apply Agent         (port 5005)  application submission
      │       ├─ ──> Form 16 Agent       (port 5006)  free tax assistant
      │       └─ ──> Form 16 Premium     (port 5007)  paid x402 (ZyndAI native)
      │
      └─ Supabase (PostgreSQL + RLS)
```

All agents communicate over **HTTP webhook** using the ZyndAI `AgentMessage` protocol. Each agent has its own **DID** registered on the ZyndAI network and can be discovered by other agents.

---

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | App Router, SSR, API Routes |
| React | 19.2.3 | UI framework |
| TypeScript | 5.x | Type safety across all pages and routes |
| Tailwind CSS | 4.x | Utility-first styling (`@import "tailwindcss"`) |
| Lucide React | 0.575.0 | Icon library |
| @supabase/supabase-js | 2.97.0 | Database client |

### Backend Agents
| Package | Purpose |
|---|---|
| `zyndai_agent` | ZyndAI SDK — DID, VC, webhook server, x402 middleware |
| `python-dotenv` | Environment variable loading |
| `supabase-py` | Python Supabase client (policy + eligibility agents) |

### Database
| Service | Purpose |
|---|---|
| Supabase (PostgreSQL) | Citizens, schemes, applications, credentials |
| Row Level Security (RLS) | Per-row access control |

### Protocol / Identity Layer
| Technology | Role |
|---|---|
| ZyndAI DID | Each agent and citizen gets a Decentralized Identifier |
| ZyndAI VC | W3C-compliant Verifiable Credential issuance and verification |
| ZyndAI x402 | Micropayment middleware — HTTP 402 Payment Required on Base network |
| Base (L2) | USDC micropayments for premium agent features |
| x402 Protocol | Open standard for HTTP-native blockchain payments |

---

## Agent Network

There are **8 Python agents**, each running as a standalone ZyndAI webhook server with its own DID and capability declaration. They are all launched by `start-agents.ps1`.

### Orchestrator — `n8n/workflows/agent.py` (port 5000)
The entry point for all eligibility queries from the frontend.

- Receives a citizen profile from `/api/agent`
- Calls **Policy Agent** to fetch all schemes
- Calls **Eligibility Agent** with citizen + schemes
- Calls **Matcher Agent** to rank results
- Calls **Credential Agent** to issue VC
- Returns a consolidated response with matched schemes + VC

### Policy Agent — `agents/policy-agent/agent.py` (port 5001)
Owns the government scheme database.

- Returns all schemes with structured eligibility rules (`age_min`, `age_max`, `income_max`, `categories`)
- First tries Supabase (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- Falls back to a hardcoded list of 15+ real Indian government schemes (PM-KISAN, Ayushman Bharat, PM Ujjwala, scholarship schemes, etc.)

### Eligibility Agent — `agents/eligibility-agent/agent.py` (port 5002)
The rule engine.

- Receives a citizen profile and a list of schemes
- For each scheme: checks age, income, category, state, and other rule fields
- Returns `eligible: true/false` with reasons for pass and fail
- Multi-criteria approach — partial matches are scored too

### Matcher Agent — `agents/matcher-agent/agent.py` (port 5003)
Scheme ranking and scoring.

- Takes eligibility results and assigns a relevance score to each matched scheme
- Sorts by score (benefit value, category match priority, etc.)
- Returns top-N ranked schemes for the citizen

### Credential Agent — `agents/credential-agent/agent.py` (port 5004)
Issues Verifiable Credentials.

- Creates a W3C VC containing the citizen's DID, matched schemes, timestamp, and issuer signature
- Stores the issued credential in Supabase (`credentials` table)
- Returns the VC token and a display badge

### Apply Agent — `agents/apply-agent/agent.py` (port 5005)
Handles scheme application submissions.

- Accepts citizen ID + scheme ID
- Creates an application record in Supabase
- Returns confirmation and next steps

### Form 16 Agent — `agents/form16-agent/agent.py` (port 5006) — FREE
A comprehensive tax assistant for salaried employees.

**10 free actions** (via `metadata.action`):

| Action | Description |
|---|---|
| `explain` | What is Form 16, Part A vs Part B |
| `tax_calc` | Compute income tax + TDS from salary inputs (new vs old regime) |
| `section_guide` | Explanation of any Income Tax section (80C, 80D, 87A, HRA…) |
| `checklist` | Documents needed to file ITR |
| `filing_steps` | Step-by-step ITR-1 / ITR-2 walkthrough |
| `tds_mismatch` | What to do when employer TDS ≠ Form 26AS TDS |
| `two_employers` | Handling two Form 16s in the same financial year |
| `download_guide` | How to download Form 16 from the TRACES portal |
| `hra_exempt` | HRA exemption calculator (metro / non-metro) |
| `query` | Free-text FAQ with keyword-based rule matching |

- Tax slabs: FY 2024-25 new regime default, full old regime support
- Standard deduction: ₹75,000 (new regime)
- Section 87A rebate: ₹25,000 on taxable income ≤ ₹7,00,000
- 4% Health + Education cess on final tax

### Form 16 Premium Agent — `agents/form16-premium-agent/agent.py` (port 5007) — PAID x402
Premium paid services with ZyndAI native x402 micropayments.

**Price: $0.10 USDC per request** — charged automatically by the ZyndAI SDK x402 middleware via `price="$0.10"` in `AgentConfig`. No custom payment verification code — the SDK handles the full 402 → payment → retry cycle.

Has its own `config_dir=".agent-form16-premium"` — a separate DID and wallet identity from the free agent.

**3 paid actions:**

| Action | Description |
|---|---|
| `generate_report` | Full regime-comparison tax report (new vs old, cess, rebate, effective rate, net take-home, recommended regime) |
| `itr_prefill` | Auto-populated ITR-1 (SAHAJ) draft field values from salary inputs |
| `tds_reconcile` | Quarter-wise Form 16 vs Form 26AS TDS reconciliation with shortfall / excess calculation |

---

## Frontend — Pages & Components

### Pages

| Route | File | Description |
|---|---|---|
| `/` | `web/app/page.tsx` | Hero landing with Puffu mascot, marquee, CTA buttons |
| `/eligibility` | `web/app/eligibility/page.tsx` | Citizen form → triggers full agent pipeline |
| `/policies` | `web/app/policies/page.tsx` | Browse all government schemes as cards |
| `/dashboard` | `web/app/dashboard/page.tsx` | Mission control: agent status, issued VCs, scheme overview |
| `/form16` | `web/app/form16/page.tsx` | 6-tab Form 16 tax assistant |

### Components

| Component | File | Description |
|---|---|---|
| `Navbar` | `components/Navbar.tsx` | Top navigation with all route links |
| `Footer` | `components/Footer.tsx` | Footer with project info and links |
| `Loader` | `components/Loader.tsx` | Animated intro screen shown on first load |
| `Mascot` | `components/Mascot.tsx` | Puffu — the CIVIS AI animated character |
| `MarqueeRow` | `components/MarqueeRow.tsx` | Scrolling marquee of scheme names / badges |
| `SchemeCard` | `components/SchemeCard.tsx` | Government scheme display card with eligibility info |
| `VCBadge` | `components/VCBadge.tsx` | Verifiable Credential display badge (issued VC) |
| `CitizenForm` | `components/CitizenForm.tsx` | Citizen profile input form (age, income, category, state) |
| `AgentStatus` | `components/AgentStatus.tsx` | Real-time agent health indicators on the dashboard |

### Design System

- **Tailwind CSS v4** — imported as `@import "tailwindcss"` (new `@theme` syntax, no `tailwind.config.js` needed)
- **Neo-brutalist** aesthetic — thick `border-2 border-black`, `shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]`, `rounded-xl`
- **Typeface**: system `font-black` + `font-mono` for financial data
- **Accent color**: `#d9ff00` (lime yellow) as the primary brand color
- **Responsive**: mobile-first grid with `md:` and `lg:` breakpoints throughout

---

## API Routes

All routes live under `web/app/api/` and use the **Next.js 15 App Router** `route.ts` pattern.

| Route | Method | Description |
|---|---|---|
| `/api/agent` | POST | Proxy to Orchestrator (port 5000). Entry point for full eligibility pipeline |
| `/api/citizen` | GET / POST | Citizen profile — create or fetch from Supabase |
| `/api/eligibility` | POST | Triggers Orchestrator flow, returns matched schemes + VC |
| `/api/vc` | GET / POST | Verifiable Credential operations — issue and verify |
| `/api/form16` | POST | Proxy to free Form 16 Agent (port 5006) with TypeScript inline fallback |
| `/api/form16/pay` | POST | x402 Payment Receipt Builder — creates `base64(JSON)` receipt from `tx_hash` |
| `/api/form16/premium` | POST / GET | Proxy to paid Form 16 Premium Agent (port 5007), forwards `X-PAYMENT-RESPONSE` header |

### Fallback Strategy

Every agent-proxy route (`/api/form16`, `/api/agent`, `/api/eligibility`) includes an **inline TypeScript fallback**. If the Python agent is offline, the Next.js route answers directly using the same rule engine logic, ensuring the UI never shows a hard error to users.

---

## Database Schema

Managed by Supabase (PostgreSQL). Schema files are in `supabase/`.

### `citizens` table
Stores citizen profiles created through the eligibility form.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `did` | `text` | ZyndAI Decentralized Identifier |
| `name` | `text` | |
| `age` | `int` | |
| `income` | `int` | Annual income in INR |
| `category` | `text` | `general`, `sc_st`, `obc`, `student`, `farmer`, `bpl`, `women`, `disabled` |
| `state` | `text` | Indian state code (e.g. `MH`, `DL`) |
| `created_at` | `timestamptz` | |

### `schemes` table
Government schemes loaded from seed data or scraper.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | Scheme slug (e.g. `pm_kisan`) |
| `name` | `text` | |
| `category` | `text` | |
| `description` | `text` | |
| `benefits` | `text` | |
| `rules` | `jsonb` | `{ age_min, age_max, income_max, categories[] }` |
| `ministry` | `text` | |
| `official_url` | `text` | |

### `applications` table
Tracks scheme applications submitted by citizens.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | |
| `citizen_id` | `uuid` | FK → citizens |
| `scheme_id` | `text` | FK → schemes |
| `status` | `text` | `pending`, `approved`, `rejected` |
| `created_at` | `timestamptz` | |

### `credentials` table
Stores issued Verifiable Credentials.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | |
| `citizen_id` | `uuid` | FK → citizens |
| `vc_token` | `text` | Full serialized VC JSON |
| `schemes` | `jsonb` | Array of matched scheme IDs |
| `issued_at` | `timestamptz` | |

Row Level Security (RLS) is enabled on all tables. Development override: `supabase/disable-rls-dev.sql`.

---

## x402 Micropayments

CIVIS AI uses the **x402 open protocol** for HTTP-native blockchain payments, integrated natively via the ZyndAI SDK.

### How It Works

```
Frontend                /api/form16/pay         /api/form16/premium        Form 16 Premium Agent (5007)
   │                          │                         │                            │
   │── POST {action, tx_hash} ──>                       │                            │
   │<── { x_payment_response } ──                       │                            │
   │                                                    │                            │
   │── POST {action, x_payment_response, ...} ─────────>│                            │
   │                                         ──── forward with X-PAYMENT-RESPONSE ──>│
   │                                                    │     ZyndAI SDK verifies     │
   │                                                    │     on-chain receipt        │
   │                                                    │<── handler result ──────────│
   │<── result ─────────────────────────────────────────│                            │
```

### Key Files

- **`/api/form16/pay/route.ts`** — Constructs the x402 receipt from `tx_hash`:
  ```
  base64(JSON.stringify({
    x402Version: 1,
    scheme: "exact",
    network: "base-mainnet",
    payload: { txHash, to: PAYMENT_WALLET, value: price_units, asset: "USDC" }
  }))
  ```
- **`/api/form16/premium/route.ts`** — Proxies to port 5007, sets `X-PAYMENT-RESPONSE` header
- **`agents/form16-premium-agent/agent.py`** — `price="$0.10"` in `AgentConfig` enables SDK middleware automatically

### Payment Flow for End User

1. Select a premium action (Generate Report / ITR Pre-fill / TDS Reconcile)
2. Send $0.10 USDC to the project wallet on **Base mainnet**
3. Copy the transaction hash and paste it in the modal
4. The frontend calls `/api/form16/pay` to build the x402 receipt
5. The receipt is forwarded to the Premium Agent with `X-PAYMENT-RESPONSE` header
6. ZyndAI SDK verifies the on-chain receipt — handler runs and returns the result

### Production Verification

`/api/form16/pay/route.ts` contains a ready-to-uncomment `eth_getTransactionReceipt` RPC call against `BASE_RPC_URL` for real on-chain transaction verification.

---

## Form 16 Tax Assistant

The `/form16` page provides a **6-tab self-service tax assistant** for Indian salaried employees.

| Tab | Content |
|---|---|
| Explain | What is Form 16, Part A vs Part B, overview of TDS |
| Tax Calc | Input salary components, get regime comparison, effective tax rate |
| Deductions | Section-by-section guide (80C, 80D, 80E, 80G, HRA, LTA, 87A…) |
| Filing | Step-by-step ITR-1 / ITR-2 guide, docs checklist |
| Verify TDS | TDS mismatch handling, two-employer scenarios, Form 26AS |
| Premium Reports | Paid premium reports via x402 — regime report, ITR pre-fill, reconciliation |

### Tax Engine (FY 2024-25)

Both agents implement the full Indian income tax computation:

- **New Regime slabs**: 0% → 5% → 10% → 15% → 20% → 30% (₹3L breakpoints)
- **Old Regime slabs**: 0% → 5% → 20% → 30% (₹2.5L / ₹5L / ₹10L breakpoints)
- **Standard deduction**: ₹75,000 (new regime FY 2024-25)
- **HRA exemption**: `min(HRA received, rent paid − 10% basic, 50%/40% basic)`
- **Section 87A rebate**: ₹25,000 for taxable income ≤ ₹7,00,000
- **Cess**: 4% Health + Education cess on final tax
- **Surcharge**: Applied above ₹50L / ₹1Cr / ₹2Cr / ₹5Cr thresholds

---

## Identity & Credentials (DID / VC)

### Decentralized Identifiers (DID)

Every entity in CIVIS AI has a DID:
- **Citizens** — assigned at profile creation, stored in `citizens.did`
- **Agents** — each agent auto-registers on startup at `registry.zynd.ai`
- **Credentials** — issued against the citizen's DID

DIDs are managed by the ZyndAI SDK. The `config_dir` parameter lets each agent maintain a separate DID keypair (the Form 16 Premium Agent uses `.agent-form16-premium` to have an isolated identity).

### Verifiable Credentials (VC)

When the Credential Agent determines a citizen is eligible, it issues a **W3C-compliant VC** containing:
- Subject DID
- List of matched scheme IDs and names
- Issue timestamp
- Issuer DID (Credential Agent's DID)
- Cryptographic signature

The VC is stored in Supabase and displayed as the **VCBadge** component on the dashboard. It can be exported and presented to government portals or NGOs for reuse — citizens don't need to re-verify.

---

## Project Structure

```
policy-navigator/
│
├── agents/
│   ├── citizen-agent/        agent.py     # DID creation (deprecated, absorbed by orchestrator)
│   ├── credential-agent/     agent.py     # VC issuance         (port 5004)
│   ├── eligibility-agent/    agent.py     # Rule engine         (port 5002)
│   ├── form16-agent/         agent.py     # Free tax assistant  (port 5006)
│   ├── form16-premium-agent/ agent.py     # Paid x402 premium   (port 5007)
│   ├── matcher-agent/        agent.py     # Scheme ranking      (port 5003)
│   └── policy-agent/         agent.py     # Scheme database     (port 5001)
│
├── n8n/workflows/
│   └── agent.py                           # Orchestrator        (port 5000)
│
├── supabase/
│   ├── schema.sql            # Table definitions
│   ├── seed.sql              # Seed scheme data
│   ├── policies.sql          # RLS policies
│   └── disable-rls-dev.sql   # Dev shortcut (no RLS)
│
├── web/                      # Next.js 16 frontend
│   ├── app/
│   │   ├── page.tsx          # Hero page
│   │   ├── layout.tsx        # Root layout (Navbar + Footer)
│   │   ├── globals.css       # Tailwind v4 import + custom styles
│   │   ├── eligibility/      # Citizen eligibility form
│   │   ├── policies/         # Browse schemes
│   │   ├── dashboard/        # Agent + VC dashboard
│   │   ├── form16/           # Form 16 tax assistant
│   │   └── api/
│   │       ├── agent/        # Orchestrator proxy
│   │       ├── citizen/      # Citizen CRUD
│   │       ├── eligibility/  # Pipeline trigger
│   │       ├── vc/           # VC operations
│   │       └── form16/
│   │           ├── route.ts         # Free agent proxy
│   │           ├── pay/route.ts     # x402 receipt builder
│   │           └── premium/route.ts # Paid agent proxy
│   ├── components/           # All React components
│   ├── lib/                  # Server Supabase client
│   ├── libs/                 # Browser Supabase + n8n client
│   └── types/                # TypeScript types (citizen, scheme, credential)
│
├── agents/.env               # Python agent secrets
├── web/.env.local            # Next.js secrets
├── start-agents.ps1          # One-command launcher for all 8 agents
├── requirements.txt          # Root Python dependencies
├── runtime.txt               # Python version pin
└── Procfile                  # Heroku-style process file
```

---

## Environment Variables

### `agents/.env`

```env
ZYND_API_KEY=your_zynd_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PAYMENT_WALLET_ADDRESS=0xYourProjectWalletAddress
BASE_RPC_URL=https://mainnet.base.org
```

### `web/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Agent URLs
POLICY_AGENT_URL=http://127.0.0.1:5001
ELIGIBILITY_AGENT_URL=http://127.0.0.1:5002
MATCHER_AGENT_URL=http://127.0.0.1:5003
CREDENTIAL_AGENT_URL=http://127.0.0.1:5004
APPLY_AGENT_URL=http://127.0.0.1:5005
FORM16_AGENT_URL=http://127.0.0.1:5006
FORM16_PREMIUM_AGENT_URL=http://127.0.0.1:5007

# x402 Payment
PAYMENT_WALLET_ADDRESS=0xYourProjectWalletAddress
BASE_RPC_URL=https://mainnet.base.org
```

---

## Running Locally

### Prerequisites

- Python 3.11+ with a virtual environment at `.venv/`
- Node.js 20+
- A Supabase project with the schema applied
- A ZyndAI API key from [zynd.ai](https://zynd.ai)

### 1. Install Python dependencies

```bash
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
```

### 2. Install frontend dependencies

```bash
cd web
npm install
```

### 3. Apply Supabase schema

Run `supabase/schema.sql` → `supabase/policies.sql` → `supabase/seed.sql` in the Supabase SQL editor.

### 4. Set environment variables

Copy and fill in `agents/.env` and `web/.env.local` from the examples above.

### 5. Start all agents

```powershell
.\start-agents.ps1
```

This launches all 8 agents on ports 5000–5007 in separate windows, kills any stale processes on those ports first, and confirms each one starts.

### 6. Start the frontend

```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Port Reference

| Port | Agent |
|---|---|
| 3000 | Next.js frontend |
| 5000 | Orchestrator |
| 5001 | Policy Agent |
| 5002 | Eligibility Agent |
| 5003 | Matcher Agent |
| 5004 | Credential Agent |
| 5005 | Apply Agent |
| 5006 | Form 16 Agent (free) |
| 5007 | Form 16 Premium Agent (x402) |

---

## Deployment

| Service | What It Hosts |
|---|---|
| **Vercel** | Next.js frontend (`web/`) |
| **Railway** | All 8 Python agents (separate services per agent) |
| **Supabase** | Managed PostgreSQL + Auth |

For Railway deployment, each agent is a separate service with its `PORT` env var set to the correct port, and the `ZYND_API_KEY` / Supabase credentials injected as environment variables.

The `Procfile` at the root defines process types for platforms that support it (Heroku, Render).

---

## Future Scope

- **Bank integration** — VC as proof of eligibility for priority loan processing
- **NGO portal** — NGOs can verify citizen VCs without re-collecting data
- **Offline VC wallet** — QR-code-based VC storage for citizens without internet
- **Bias detection** — Audit trail on eligibility decisions to detect category-based bias in scheme rules
- **Aadhaar eKYC bridge** — Link DID to Aadhaar for government-grade verification
- **Multi-language support** — Hindi, Marathi, Bengali, Tamil UI translations
- **Scheme scraper** — Automated scraping of MyScheme.gov.in to keep the scheme database fresh
- **Agency portal** — Government agency dashboard to publish new schemes and review applications












http://localhost:5678/webhook-test/citizen-agent