#!/usr/bin/env python3
"""
CIVIS AI — Government Scheme Scraper
=====================================
Scrapes real scheme data from official Indian government portals and
upserts into the Supabase `schemes` table.

Sources:
  1. myscheme.gov.in  — parses __NEXT_DATA__ JSON from individual scheme pages
  2. pmindia.gov.in   — scrapes PM India scheme listings
  3. india.gov.in     — National Portal scheme pages
  4. Built-in dataset — 40+ verified real schemes (always runs)

Usage:
  python scripts/scrape_schemes.py                         # all sources
  python scripts/scrape_schemes.py --source myscheme       # specific source
  python scripts/scrape_schemes.py --source builtin        # only built-in data
  python scripts/scrape_schemes.py --dry-run               # print, don't save
  python scripts/scrape_schemes.py --limit 20              # cap per source

Requirements:
  pip install requests beautifulsoup4 python-dotenv supabase
"""

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup

# ── Load env from .env file if present ────────────────────────────────────────
try:
    from dotenv import load_dotenv
    root = Path(__file__).parent.parent
    load_dotenv(root / ".env")
    load_dotenv(root / "web" / ".env.local")
except ImportError:
    pass

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or os.environ.get("SUPABASE_KEY", "")
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def slug_to_id(slug: str) -> str:
    """Normalise a URL slug to a stable DB id."""
    s = unicodedata.normalize("NFKD", slug.lower())
    s = re.sub(r"[^a-z0-9\-]", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s[:80]


def clean(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    return re.sub(r"\s+", " ", text).strip() or None


def infer_category(text: str) -> str:
    t = text.lower()
    for kw, cat in [
        ("kisan", "farmer"), ("agriculture", "farmer"), ("crop", "farmer"), ("farmer", "farmer"),
        ("student", "student"), ("scholarship", "student"), ("education", "student"), ("school", "student"),
        ("women", "women"), ("mahila", "women"), ("girl", "women"), ("maternity", "women"),
        ("health", "health"), ("medical", "health"), ("ayushman", "health"), ("hospital", "health"),
        ("senior", "senior_citizen"), ("pension", "senior_citizen"), ("old age", "senior_citizen"),
        ("sc ", "sc_st"), ("st ", "sc_st"), ("scheduled", "sc_st"), ("tribal", "sc_st"),
        ("obc", "obc"), ("backward", "obc"),
        ("disabled", "disabled"), ("disability", "disabled"), ("divyang", "disabled"),
        ("bpl", "bpl"), ("poverty", "bpl"), ("ration", "bpl"), ("below poverty", "bpl"),
    ]:
        if kw in t:
            return cat
    return "general"


def safe_get(url: str, timeout: int = 15) -> Optional[requests.Response]:
    try:
        r = SESSION.get(url, timeout=timeout)
        r.raise_for_status()
        return r
    except Exception as e:
        print(f"  ✗ GET {url[:80]}: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 1 — Built-in verified dataset (always available)
# ─────────────────────────────────────────────────────────────────────────────

BUILTIN_SCHEMES = [
    # ── Farmer ──────────────────────────────────────────────────────────────
    {
        "id": "pm-kisan", "name": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
        "category": "farmer", "ministry": "Ministry of Agriculture & Farmers Welfare",
        "description": "Direct income support of ₹6,000/year to small and marginal farmers in three equal instalments of ₹2,000 each.",
        "benefits": "₹6,000 per year (₹2,000 every 4 months) direct bank transfer",
        "eligibility_text": "Small and marginal farmers with landholding up to 2 hectares. Family income from farming activities only.",
        "rules": {"max_land_ha": 2, "requires_aadhaar": True, "bank_account": True},
        "official_url": "https://pmkisan.gov.in/",
        "source": "pmindia.gov.in", "state_specific": False,
    },
    {
        "id": "pm-fasal-bima", "name": "PM Fasal Bima Yojana (PMFBY)",
        "category": "farmer", "ministry": "Ministry of Agriculture & Farmers Welfare",
        "description": "Comprehensive crop insurance providing financial support to farmers suffering crop loss/damage due to unforeseen calamities, pests & diseases.",
        "benefits": "Insurance coverage for crop loss; premium subsidised by government (1.5–5% for farmers)",
        "eligibility_text": "All farmers including sharecroppers and tenant farmers growing notified crops.",
        "rules": {"premium_max_pct": 5, "covers_natural_calamities": True},
        "official_url": "https://pmfby.gov.in/",
        "source": "pmindia.gov.in", "state_specific": False,
    },
    {
        "id": "pm-kisan-maan-dhan", "name": "PM Kisan Maan-Dhan Yojana",
        "category": "farmer", "ministry": "Ministry of Agriculture & Farmers Welfare",
        "description": "Voluntary and contributory pension scheme for small and marginal farmers to provide them social security.",
        "benefits": "₹3,000/month pension after age 60",
        "eligibility_text": "Small and marginal farmers aged 18–40 years with cultivable land up to 2 hectares.",
        "rules": {"min_age": 18, "max_age": 40, "max_land_ha": 2, "entry_age_range": "18-40"},
        "official_url": "https://maandhan.in/",
        "source": "pmindia.gov.in", "state_specific": False,
    },
    {
        "id": "pm-kusum", "name": "PM-KUSUM (Kisan Urja Suraksha Uttham Mahabhiyan)",
        "category": "farmer", "ministry": "Ministry of New and Renewable Energy",
        "description": "Scheme for installation of solar pumps and grid-connected solar power plants for farmers.",
        "benefits": "Solar powered agricultural pumps; financial assistance up to 60% of cost",
        "eligibility_text": "Farmers with barren/uncultivable land or requiring irrigation. State-specific implementation.",
        "rules": {"solar_pump": True, "subsidy_pct": 60},
        "official_url": "https://mnre.gov.in/solar/schemes",
        "source": "mnre.gov.in", "state_specific": True,
    },
    {
        "id": "kcc-scheme", "name": "Kisan Credit Card (KCC) Scheme",
        "category": "farmer", "ministry": "Ministry of Agriculture & Farmers Welfare",
        "description": "Provides farmers with timely credit support from the banking system for their agricultural operations, maintenance of farm assets and allied activities.",
        "benefits": "Short-term credit up to ₹3 lakh at 4% interest rate with crop insurance",
        "eligibility_text": "All farmers, SHGs, and Joint Liability Groups of farmers including tenant farmers and oral lessees.",
        "rules": {"max_credit_lakh": 3, "interest_rate_pct": 4},
        "official_url": "https://www.nabard.org/",
        "source": "nabard.org", "state_specific": False,
    },
    # ── Student ─────────────────────────────────────────────────────────────
    {
        "id": "nsp-central-scholarships", "name": "National Scholarship Portal (NSP) Scholarships",
        "category": "student", "ministry": "Ministry of Education",
        "description": "Central umbrella portal providing multiple scholarship schemes for pre-matric, post-matric and merit-based scholarships.",
        "benefits": "Scholarships from ₹500 to ₹20,000+ per year depending on scheme and level of education",
        "eligibility_text": "Students from Class 1 to PhD depending on particular scheme. Income limit ₹2.5–8 lakh per annum.",
        "rules": {"max_income": 800000, "covers": ["pre-matric", "post-matric", "merit-based"]},
        "official_url": "https://scholarships.gov.in/",
        "source": "scholarships.gov.in", "state_specific": False,
    },
    {
        "id": "pm-vidya-lakshmi", "name": "PM Vidya Lakshmi Education Loan",
        "category": "student", "ministry": "Ministry of Education",
        "description": "Single window for students to access education loans and scholarships from multiple banks.",
        "benefits": "Education loans at subsidised interest rates; full interest subsidy during moratorium for students from EWS/LIG",
        "eligibility_text": "Students seeking admission to recognised colleges in India or abroad.",
        "rules": {"interest_subsidy": True, "ews_lig_eligible": True},
        "official_url": "https://www.vidyalakshmi.co.in/",
        "source": "vidyalakshmi.co.in", "state_specific": False,
    },
    {
        "id": "pm-e-vidya", "name": "PM eVidya",
        "category": "student", "ministry": "Ministry of Education",
        "description": "Multi-mode access to digital/online education to ensure uninterrupted learning during and post COVID-19.",
        "benefits": "Free access to educational content via DIKSHA portal, DTH channels, radio, and podcasts",
        "eligibility_text": "All students from Class 1 to 12 across India",
        "rules": {"free_access": True, "digital_platform": True},
        "official_url": "https://diksha.gov.in/",
        "source": "education.gov.in", "state_specific": False,
    },
    {
        "id": "cbse-merit-scholarship", "name": "CBSE Merit Scholarship Scheme",
        "category": "student", "ministry": "Ministry of Education",
        "description": "Scholarship for single girl child studying in CBSE affiliated schools.",
        "benefits": "₹500/month scholarship for 2 years in Class 11–12",
        "eligibility_text": "Single girl child who scored at least 60% in Class X CBSE board examination.",
        "rules": {"min_marks_pct": 60, "single_girl_child": True},
        "official_url": "https://cbse.gov.in/",
        "source": "cbse.gov.in", "state_specific": False,
    },
    {
        "id": "pm-pariksha-pe-charcha", "name": "Pariksha Pe Charcha",
        "category": "student", "ministry": "Ministry of Education",
        "description": "Annual event where PM interacts with students, parents and teachers to make exams a celebration.",
        "benefits": "Stress management for students; guidance from PM; winners get selected for the event",
        "eligibility_text": "Students of Classes 6–12 across India",
        "rules": {"annual_event": True},
        "official_url": "https://innovateindia.mygov.in/ppc/",
        "source": "mygov.in", "state_specific": False,
    },
    # ── Health ───────────────────────────────────────────────────────────────
    {
        "id": "ayushman-bharat-pmjay", "name": "Ayushman Bharat — PM Jan Arogya Yojana (AB-PMJAY)",
        "category": "health", "ministry": "Ministry of Health & Family Welfare",
        "description": "World's largest government-funded health assurance scheme providing health cover of ₹5 lakh per family per year.",
        "benefits": "₹5 lakh/year health cover for hospitalisation; cashless treatment at 24,000+ empanelled hospitals",
        "eligibility_text": "Families in bottom 40% socio-economic group identified through SECC database. No income limit.",
        "rules": {"health_cover_lakh": 5, "cashless": True, "secc_database": True},
        "official_url": "https://pmjay.gov.in/",
        "source": "pmjay.gov.in", "state_specific": False,
    },
    {
        "id": "pm-surakshit-matritva-abhiyan", "name": "Pradhan Mantri Surakshit Matritva Abhiyan",
        "category": "health", "ministry": "Ministry of Health & Family Welfare",
        "description": "Provides assured, comprehensive and quality antenatal care, free of cost, on the 9th day of every month.",
        "benefits": "Free ante-natal checkups on every 9th of the month at health facilities",
        "eligibility_text": "All pregnant women in their 2nd or 3rd trimester",
        "rules": {"free_antenatal_care": True, "monthly_9th_checkup": True},
        "official_url": "https://pmsma.nhp.gov.in/",
        "source": "nhp.gov.in", "state_specific": False,
    },
    {
        "id": "rashtriya-swasthya-bima-yojana", "name": "Rashtriya Swasthya Bima Yojana (RSBY)",
        "category": "health", "ministry": "Ministry of Labour & Employment",
        "description": "Health insurance to BPL families and certain categories of unorganised workers.",
        "benefits": "₹30,000 health insurance coverage per family per year; cashless treatment",
        "eligibility_text": "BPL families and unorganised sector workers. Family = head + spouse + up to 3 dependents.",
        "rules": {"max_family_size": 5, "cover_rs": 30000, "bpl_only": True},
        "official_url": "https://www.rsby.gov.in/",
        "source": "labour.gov.in", "state_specific": False,
    },
    # ── Women ────────────────────────────────────────────────────────────────
    {
        "id": "pm-matru-vandana", "name": "Pradhan Mantri Matru Vandana Yojana (PMMVY)",
        "category": "women", "ministry": "Ministry of Women and Child Development",
        "description": "Maternity benefit programme providing cash incentives to pregnant and lactating mothers for first living child.",
        "benefits": "₹5,000 in three instalments during pregnancy and after childbirth",
        "eligibility_text": "All pregnant and lactating women except those in regular employment with the Central/State Government.",
        "rules": {"instalments": 3, "total_benefit": 5000, "first_child": True},
        "official_url": "https://wcd.nic.in/",
        "source": "wcd.nic.in", "state_specific": False,
    },
    {
        "id": "sukanya-samriddhi-yojana", "name": "Sukanya Samriddhi Yojana (SSY)",
        "category": "women", "ministry": "Ministry of Finance",
        "description": "Small deposit scheme for the girl child to build a fund for higher education and marriage.",
        "benefits": "8.2% per annum interest (tax-free); ₹250 min to ₹1.5 lakh max annual deposit",
        "eligibility_text": "Girl child up to 10 years of age. Account opened by parent/guardian.",
        "rules": {"max_age_girl": 10, "min_deposit": 250, "max_deposit_pa": 150000, "interest_rate_pct": 8.2},
        "official_url": "https://www.indiapost.gov.in/",
        "source": "indiapost.gov.in", "state_specific": False,
    },
    {
        "id": "beti-bachao-beti-padhao", "name": "Beti Bachao Beti Padhao",
        "category": "women", "ministry": "Ministry of Women and Child Development",
        "description": "Addresses declining Child Sex Ratio and promotion of welfare and education of the girl child.",
        "benefits": "Awareness campaigns; school enrolment of girls; community mobilisation for girl child welfare",
        "eligibility_text": "All girl children, particularly in districts with low Child Sex Ratio",
        "rules": {"focus_on_girl_child": True, "awareness_campaign": True},
        "official_url": "https://wcd.nic.in/bbbp-schemes",
        "source": "wcd.nic.in", "state_specific": False,
    },
    {
        "id": "pm-ujjwala-yojana", "name": "Pradhan Mantri Ujjwala Yojana (PMUY)",
        "category": "women", "ministry": "Ministry of Petroleum & Natural Gas",
        "description": "Free LPG connections to women from BPL households to replace unclean cooking fuels.",
        "benefits": "Free LPG connection (cylinder + regulator); ₹1,600 cash assistance; first refill free",
        "eligibility_text": "Women over 18 from BPL household. PMUY 2.0 extended to migrants and rent-dwellers.",
        "rules": {"min_age": 18, "bpl": True, "free_connection": True},
        "official_url": "https://www.pmujjwalayojana.com/",
        "source": "petroleum.gov.in", "state_specific": False,
    },
    # ── Housing ──────────────────────────────────────────────────────────────
    {
        "id": "pm-awas-yojana-urban", "name": "Pradhan Mantri Awas Yojana — Urban (PMAY-U)",
        "category": "general", "ministry": "Ministry of Housing and Urban Affairs",
        "description": "Housing for All by 2022 mission to provide pucca housing to urban poor.",
        "benefits": "Subsidy up to ₹2.67 lakh on home loan; in-situ slum rehabilitation; affordable housing",
        "eligibility_text": "EWS/LIG/MIG families without pucca house in any part of India. First-time house buyers.",
        "rules": {"beneficiary_categories": ["EWS", "LIG", "MIG"], "subsidy_max_lakh": 2.67},
        "official_url": "https://pmaymis.gov.in/",
        "source": "mohua.gov.in", "state_specific": False,
    },
    {
        "id": "pm-awas-yojana-grameen", "name": "Pradhan Mantri Awas Yojana — Gramin (PMAY-G)",
        "category": "general", "ministry": "Ministry of Rural Development",
        "description": "Provides financial assistance to rural households to construct pucca houses with basic amenities.",
        "benefits": "₹1.2 lakh (plains) or ₹1.3 lakh (hills/difficult areas) for construction",
        "eligibility_text": "Homeless rural households or those living in zero room, kutcha or dilapidated houses per SECC 2011.",
        "rules": {"plains_benefit": 120000, "hills_benefit": 130000, "secc_based": True},
        "official_url": "https://pmayg.nic.in/",
        "source": "rural.gov.in", "state_specific": False,
    },
    # ── Employment ───────────────────────────────────────────────────────────
    {
        "id": "mgnregs", "name": "MGNREGS (Mahatma Gandhi National Rural Employment Guarantee Scheme)",
        "category": "general", "ministry": "Ministry of Rural Development",
        "description": "Provides legal guarantee of at least 100 days of unskilled wage employment per year to rural households.",
        "benefits": "100 days/year guaranteed employment; wages ₹220–350/day depending on state; work within 5km of home",
        "eligibility_text": "Any adult member of a rural household willing to do unskilled manual work.",
        "rules": {"min_days_guaranteed": 100, "rural_only": True, "unskilled_only": True},
        "official_url": "https://nrega.nic.in/",
        "source": "rural.gov.in", "state_specific": False,
    },
    {
        "id": "pm-mudra-yojana", "name": "Pradhan Mantri MUDRA Yojana (PMMY)",
        "category": "general", "ministry": "Ministry of Finance",
        "description": "Provides loans up to ₹10 lakh to non-corporate, non-farm small/micro enterprises.",
        "benefits": "Shishu (up to ₹50K), Kishore (₹50K–5L), Tarun (₹5L–10L) — no collateral required",
        "eligibility_text": "Non-farm micro/small enterprises including individuals, proprietorships, partnerships.",
        "rules": {"max_loan_lakh": 10, "no_collateral": True, "categories": ["Shishu", "Kishore", "Tarun"]},
        "official_url": "https://www.mudra.org.in/",
        "source": "mudra.org.in", "state_specific": False,
    },
    {
        "id": "pm-employment-generation-programme", "name": "Prime Minister's Employment Generation Programme (PMEGP)",
        "category": "general", "ministry": "Ministry of MSME",
        "description": "Credit-linked subsidy programme for generating employment opportunities through establishment of micro-enterprises.",
        "benefits": "15–35% subsidy on project cost; projects up to ₹25 lakh (manufacturing) / ₹10 lakh (service)",
        "eligibility_text": "Individuals above 18 years. SC/ST/Women/Ex-servicemen/PHC get higher subsidy.",
        "rules": {"min_age": 18, "max_project_lakh_mfg": 25, "max_project_lakh_service": 10},
        "official_url": "https://www.kviconline.gov.in/pmegpeportal/",
        "source": "msme.gov.in", "state_specific": False,
    },
    # ── Banking ──────────────────────────────────────────────────────────────
    {
        "id": "pm-jan-dhan-yojana", "name": "Pradhan Mantri Jan Dhan Yojana (PMJDY)",
        "category": "general", "ministry": "Ministry of Finance",
        "description": "National mission for financial inclusion to ensure access to financial services for all households.",
        "benefits": "Zero-balance bank account; RuPay debit card; ₹2 lakh accident insurance; ₹10,000 overdraft",
        "eligibility_text": "Any Indian citizen without a bank account. No minimum balance required.",
        "rules": {"zero_balance": True, "accident_insurance": 200000, "overdraft": 10000},
        "official_url": "https://pmjdy.gov.in/",
        "source": "pmjdy.gov.in", "state_specific": False,
    },
    {
        "id": "pm-jeevan-jyoti-bima", "name": "Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)",
        "category": "general", "ministry": "Ministry of Finance",
        "description": "Life insurance scheme offering coverage for death due to any reason.",
        "benefits": "₹2 lakh life insurance coverage at premium of ₹436/year",
        "eligibility_text": "Bank account holders aged 18–50 years with Aadhaar-linked account.",
        "rules": {"min_age": 18, "max_age": 50, "premium_pa": 436, "cover": 200000},
        "official_url": "https://jansuraksha.gov.in/",
        "source": "jansuraksha.gov.in", "state_specific": False,
    },
    {
        "id": "pm-suraksha-bima-yojana", "name": "Pradhan Mantri Suraksha Bima Yojana (PMSBY)",
        "category": "general", "ministry": "Ministry of Finance",
        "description": "Accidental death and disability insurance scheme at very affordable premium.",
        "benefits": "₹2 lakh for accidental death/full disability; ₹1 lakh for partial disability; premium ₹20/year",
        "eligibility_text": "Bank account holders aged 18–70 years with Aadhaar-linked bank account.",
        "rules": {"min_age": 18, "max_age": 70, "premium_pa": 20, "cover": 200000},
        "official_url": "https://jansuraksha.gov.in/",
        "source": "jansuraksha.gov.in", "state_specific": False,
    },
    # ── SC/ST ────────────────────────────────────────────────────────────────
    {
        "id": "post-matric-scholarship-sc", "name": "Post Matric Scholarships for SC Students",
        "category": "sc_st", "ministry": "Ministry of Social Justice & Empowerment",
        "description": "Financial assistance to SC students to enable them to complete their post-matriculation education.",
        "benefits": "Maintenance allowance + tuition fees (varies by course); ₹550–1,200/month",
        "eligibility_text": "SC students studying in Class 11 and above. Annual family income up to ₹2.5 lakh.",
        "rules": {"max_income": 250000, "sc_only": True, "post_matric": True},
        "official_url": "https://scholarships.gov.in/",
        "source": "socialjustice.gov.in", "state_specific": False,
    },
    {
        "id": "post-matric-scholarship-st", "name": "Post Matric Scholarships for ST Students",
        "category": "sc_st", "ministry": "Ministry of Tribal Affairs",
        "description": "Financial assistance to Scheduled Tribe students to pursue post-matric studies.",
        "benefits": "Full tuition fee reimbursement + maintenance allowance; hostel charges covered",
        "eligibility_text": "ST students from Class 11 onwards. Annual family income up to ₹2.5 lakh.",
        "rules": {"max_income": 250000, "st_only": True, "post_matric": True},
        "official_url": "https://tribal.nic.in/",
        "source": "tribal.gov.in", "state_specific": False,
    },
    {
        "id": "scheduled-caste-development-scholarship", "name": "Pre-Matric Scholarship for SC Students",
        "category": "sc_st", "ministry": "Ministry of Social Justice & Empowerment",
        "description": "Scholarship for SC students studying in Class 9 and 10 to prevent dropout.",
        "benefits": "₹150–750/month maintenance allowance + books and stationery allowance",
        "eligibility_text": "SC students in Class 9–10 with family income up to ₹2.5 lakh pa.",
        "rules": {"max_income": 250000, "sc_only": True, "classes": "9-10"},
        "official_url": "https://scholarships.gov.in/",
        "source": "socialjustice.gov.in", "state_specific": False,
    },
    # ── Senior Citizen ───────────────────────────────────────────────────────
    {
        "id": "indira-gandhi-national-old-age-pension", "name": "Indira Gandhi National Old Age Pension Scheme (IGNOAPS)",
        "category": "senior_citizen", "ministry": "Ministry of Rural Development",
        "description": "Pension scheme for BPL elderly persons to provide social security.",
        "benefits": "₹200–500/month (Centre); states add additional contribution",
        "eligibility_text": "Persons aged 60 years and above belonging to BPL household.",
        "rules": {"min_age": 60, "bpl": True, "monthly_pension_centre": 500},
        "official_url": "https://nsap.nic.in/",
        "source": "rural.gov.in", "state_specific": False,
    },
    {
        "id": "atal-pension-yojana", "name": "Atal Pension Yojana (APY)",
        "category": "senior_citizen", "ministry": "Ministry of Finance",
        "description": "Pension scheme for unorganised sector workers guaranteeing minimum pension of ₹1,000–5,000/month at age 60.",
        "benefits": "Guaranteed monthly pension of ₹1,000–₹5,000 after age 60; government co-contribution for eligible subscribers",
        "eligibility_text": "Citizens aged 18–40 with a savings bank account. Not an income taxpayer.",
        "rules": {"min_age": 18, "max_age": 40, "min_pension": 1000, "max_pension": 5000},
        "official_url": "https://npscra.nsdl.co.in/",
        "source": "finmin.gov.in", "state_specific": False,
    },
    # ── BPL / General ────────────────────────────────────────────────────────
    {
        "id": "pm-garib-kalyan-anna-yojana", "name": "PM Garib Kalyan Anna Yojana (PMGKAY)",
        "category": "bpl", "ministry": "Ministry of Consumer Affairs, Food & Public Distribution",
        "description": "Free food grain scheme providing 5 kg of rice/wheat per person per month to NFSA beneficiaries.",
        "benefits": "5 kg free food grain per person per month (rice/wheat)",
        "eligibility_text": "All NFSA (National Food Security Act) beneficiaries — Antyodaya and Priority Household ration card holders.",
        "rules": {"kg_per_person_per_month": 5, "free": True, "nfsa_card_required": True},
        "official_url": "https://nfsa.gov.in/",
        "source": "nfsa.gov.in", "state_specific": False,
    },
    {
        "id": "one-nation-one-ration-card", "name": "One Nation One Ration Card (ONORC)",
        "category": "bpl", "ministry": "Ministry of Consumer Affairs, Food & Public Distribution",
        "description": "Allows NFSA beneficiaries to claim their entitled food grains from any Fair Price Shop in India.",
        "benefits": "Portability of ration card; claim subsidised food from any FPS across India",
        "eligibility_text": "All NFSA ration card holders including migrant workers",
        "rules": {"pan_india_portability": True, "ration_card_required": True},
        "official_url": "https://impds.nic.in/",
        "source": "nfsa.gov.in", "state_specific": False,
    },
    {
        "id": "pm-svamitva-scheme", "name": "PM SVAMITVA Scheme",
        "category": "general", "ministry": "Ministry of Panchayati Raj",
        "description": "Survey of villages and mapping with improved technology (SVAMITVA) — property rights to rural households.",
        "benefits": "Property cards ('aabaadi' land rights) enabling bank loans; dispute resolution; planning",
        "eligibility_text": "Rural households in abadi (inhabited) areas of villages",
        "rules": {"drone_survey": True, "property_card": True},
        "official_url": "https://svamitva.nic.in/",
        "source": "panchayat.gov.in", "state_specific": False,
    },
    {
        "id": "jal-jeevan-mission", "name": "Jal Jeevan Mission (JJM)",
        "category": "general", "ministry": "Ministry of Jal Shakti",
        "description": "Mission to provide safe and adequate drinking water through individual household tap connections by 2024.",
        "benefits": "Functional Household Tap Connection (FHTC); 55 litres/person/day potable water",
        "eligibility_text": "Rural households without tap water connection across India",
        "rules": {"rural_only": True, "litres_ppd": 55},
        "official_url": "https://jaljeevanmission.gov.in/",
        "source": "jaljeevanmission.gov.in", "state_specific": False,
    },
    {
        "id": "pm-ujjwala-2", "name": "Ujjwala 2.0 — LPG Connection for Migrants",
        "category": "bpl", "ministry": "Ministry of Petroleum & Natural Gas",
        "description": "Extension of PMUY to include migrant workers and those without permanent address proof.",
        "benefits": "Free LPG connection; 12 refill cylinders; deposit-free connection; no address proof needed",
        "eligibility_text": "Migrant workers and BPL women without existing LPG connection. Self-declaration accepted.",
        "rules": {"migrant_eligible": True, "no_address_proof": True},
        "official_url": "https://www.pmujjwalayojana.com/",
        "source": "petroleum.gov.in", "state_specific": False,
    },
    {
        "id": "standup-india", "name": "Stand-Up India Scheme",
        "category": "sc_st", "ministry": "Ministry of Finance",
        "description": "Facilitates bank loans between ₹10 lakh and ₹1 crore for SC/ST and women entrepreneurs.",
        "benefits": "Loans ₹10L–₹1Cr for greenfield enterprises; 7-year repayment; RuPay credit card",
        "eligibility_text": "SC/ST or women above 18 years for greenfield (first-time) enterprises in manufacturing, services or trading.",
        "rules": {"min_loan_lakh": 10, "max_loan_lakh": 100, "min_age": 18, "sc_st_or_women": True},
        "official_url": "https://www.standupmitra.in/",
        "source": "standupmitra.in", "state_specific": False,
    },
    {
        "id": "pm-kaushal-vikas-yojana", "name": "Pradhan Mantri Kaushal Vikas Yojana (PMKVY)",
        "category": "general", "ministry": "Ministry of Skill Development & Entrepreneurship",
        "description": "Skill certification scheme that enables youth to take up industry-relevant training.",
        "benefits": "Free skill training aligned to National Skill Qualification Framework (NSQF); certification; ₹8,000 reward",
        "eligibility_text": "Indian nationals above 15 years seeking skill development training.",
        "rules": {"min_age": 15, "free_training": True, "reward": 8000},
        "official_url": "https://www.pmkvyofficial.org/",
        "source": "msde.gov.in", "state_specific": False,
    },
    {
        "id": "disabled-scholarship-nsdcs", "name": "National Scholarship for Disabled Students",
        "category": "disabled", "ministry": "Ministry of Social Justice & Empowerment",
        "description": "Scholarship to students with disability for pursuing professional and technical courses.",
        "benefits": "₹3,000–10,000 per annum for day scholars; ₹5,000–15,000 for hostellers",
        "eligibility_text": "Students with minimum 40% disability studying at Class 9 and above. Family income up to ₹2.5 lakh.",
        "rules": {"min_disability_pct": 40, "max_income": 250000},
        "official_url": "https://scholarships.gov.in/",
        "source": "socialjustice.gov.in", "state_specific": False,
    },
    {
        "id": "pm-disha-scheme", "name": "DISHA (Deendayal Disabled Rehabilitation Scheme)",
        "category": "disabled", "ministry": "Ministry of Social Justice & Empowerment",
        "description": "Financial assistance to NGOs working for the rehabilitation of persons with disabilities.",
        "benefits": "Rehabilitation services, education, vocational training, and community-based rehabilitation",
        "eligibility_text": "Persons with disabilities including locomotor, visual, hearing, and intellectual disabilities",
        "rules": {"ngo_administered": True, "covers_all_disabilities": True},
        "official_url": "https://disabilityaffairs.gov.in/",
        "source": "socialjustice.gov.in", "state_specific": False,
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 2 — myscheme.gov.in (scrapes __NEXT_DATA__ from individual scheme pages)
# ─────────────────────────────────────────────────────────────────────────────

MYSCHEME_SLUGS = [
    "pmkisan", "pmfby", "pm-kisan-maan-dhan-yojana", "ab-pmjay", "pmuy",
    "pm-awas-yojana-urban", "pm-awas-yojana-gramin", "pmjdy", "pmjjby",
    "pmsby", "mgnregs", "pm-kvy", "pmegp", "pm-mudra-yojana",
    "sukanya-samriddhi-yojana", "pmmvy", "bbbp", "atal-pension-yojana",
    "stand-up-india", "jal-jeevan-mission", "svamitva", "nsp",
    "post-matric-scholarship-sc-students", "post-matric-scholarship-st-students",
    "pm-ujjwala-2-0", "pm-garib-kalyan-anna-yojana", "onorc",
    "pm-e-vidya", "pm-fasal-bima-yojana",
]


def scrape_myscheme(limit: int = 30) -> list[dict]:
    print("\n[myscheme.gov.in] Fetching scheme pages…")
    results = []
    base = "https://www.myscheme.gov.in/schemes"

    for slug in MYSCHEME_SLUGS[:limit]:
        url = f"{base}/{slug}"
        resp = safe_get(url)
        if not resp:
            time.sleep(0.5)
            continue

        soup = BeautifulSoup(resp.text, "html.parser")
        nd_tag = soup.find("script", id="__NEXT_DATA__")
        if not nd_tag or not nd_tag.string:
            # fallback: try to read meta tags
            title = soup.find("title")
            name = clean(title.get_text()) if title else slug.replace("-", " ").title()
            desc_meta = soup.find("meta", {"name": "description"})
            desc = clean(desc_meta["content"]) if desc_meta else None

            results.append({
                "id": slug_to_id(slug),
                "name": name or slug.replace("-", " ").title(),
                "category": infer_category(name or slug),
                "description": desc,
                "benefits": None,
                "eligibility_text": None,
                "rules": {},
                "ministry": None,
                "official_url": url,
                "source": "myscheme.gov.in",
                "state_specific": False,
            })
            print(f"  ~ {slug} (meta only)")
            time.sleep(0.4)
            continue

        try:
            nd = json.loads(nd_tag.string)
            # myscheme stores data under props.pageProps.schemeData or similar
            page_props = nd.get("props", {}).get("pageProps", {})
            scheme_data = (
                page_props.get("schemeData")
                or page_props.get("data")
                or page_props.get("scheme")
                or {}
            )

            name = (
                clean(scheme_data.get("schemeName") or scheme_data.get("name") or scheme_data.get("title"))
                or slug.replace("-", " ").title()
            )
            desc = clean(scheme_data.get("schemeShortTitle") or scheme_data.get("description") or scheme_data.get("briefDescription"))
            benefits = clean(scheme_data.get("benefitsOffered") or scheme_data.get("benefits"))
            eligibility = clean(scheme_data.get("eligibilityCriteria") or scheme_data.get("eligibility"))
            ministry = clean(scheme_data.get("nodeName") or scheme_data.get("ministry") or scheme_data.get("nodalMinistry"))
            official_url = scheme_data.get("schemeUrl") or scheme_data.get("officialUrl") or url

            results.append({
                "id": slug_to_id(slug),
                "name": name,
                "category": infer_category(f"{name or ''} {desc or ''} {ministry or ''}"),
                "description": desc,
                "benefits": benefits,
                "eligibility_text": eligibility,
                "rules": {},
                "ministry": ministry,
                "official_url": official_url,
                "source": "myscheme.gov.in",
                "state_specific": False,
            })
            print(f"  ✓ {name[:60]}")
        except (json.JSONDecodeError, KeyError) as e:
            print(f"  ✗ parse error for {slug}: {e}")

        time.sleep(0.5)

    print(f"  → Got {len(results)} schemes from myscheme.gov.in")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# SOURCE 3 — pmindia.gov.in central schemes listing
# ─────────────────────────────────────────────────────────────────────────────

def scrape_pmindia(limit: int = 30) -> list[dict]:
    print("\n[pmindia.gov.in] Fetching scheme listing…")
    urls_to_try = [
        "https://www.pmindia.gov.in/en/government_tr_pg/central-sector-scheme/",
        "https://www.pmindia.gov.in/en/government_tr_pg/centrally-sponsored-schemes/",
        "https://www.india.gov.in/my-government/government-schemes",
    ]

    results = []

    for url in urls_to_try:
        resp = safe_get(url)
        if not resp:
            continue

        soup = BeautifulSoup(resp.text, "html.parser")
        links = soup.find_all("a", href=True)

        for link in links:
            href = link.get("href", "")
            text = clean(link.get_text())
            if not text or len(text) < 8:
                continue
            # Only pick clearly scheme-like links
            if not any(kw in href.lower() for kw in ["scheme", "yojana", "mission", "abhiyan", "programme"]):
                if not any(kw in text.lower() for kw in ["yojana", "scheme", "mission", "programme", "abhiyan"]):
                    continue

            if len(results) >= limit:
                break

            scheme_id = slug_to_id(re.sub(r"https?://[^/]+", "", href).strip("/") or text)
            results.append({
                "id": scheme_id[:80],
                "name": text[:200],
                "category": infer_category(text),
                "description": f"Government scheme: {text}",
                "benefits": None,
                "eligibility_text": None,
                "rules": {},
                "ministry": None,
                "official_url": href if href.startswith("http") else f"https://pmindia.gov.in{href}",
                "source": "pmindia.gov.in",
                "state_specific": False,
            })

        if results:
            print(f"  → Got {len(results)} scheme links from {url}")
            break
        time.sleep(0.5)

    if not results:
        print("  ✗ Could not scrape pmindia.gov.in — trying india.gov.in sectors…")
        results = _scrape_india_gov(limit)

    return results


def _scrape_india_gov(limit: int = 20) -> list[dict]:
    url = "https://www.india.gov.in/topics/social-welfare"
    resp = safe_get(url)
    if not resp:
        return []
    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    for tag in soup.find_all(["h2", "h3", "h4", "li", "a"], limit=100):
        text = clean(tag.get_text())
        if not text or len(text) < 8:
            continue
        if any(kw in text.lower() for kw in ["yojana", "scheme", "mission", "abhiyan"]):
            results.append({
                "id": slug_to_id(text[:60]),
                "name": text[:200],
                "category": infer_category(text),
                "description": f"Government initiative: {text}",
                "benefits": None,
                "eligibility_text": None,
                "rules": {},
                "ministry": None,
                "official_url": "https://www.india.gov.in/topics/social-welfare",
                "source": "india.gov.in",
                "state_specific": False,
            })
            if len(results) >= limit:
                break
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Deduplication
# ─────────────────────────────────────────────────────────────────────────────

def deduplicate(schemes: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}
    for s in schemes:
        sid = s["id"]
        if sid not in seen:
            seen[sid] = s
        else:
            # Prefer the entry with more filled fields
            existing = seen[sid]
            if (s.get("description") and not existing.get("description")) or \
               (s.get("benefits") and not existing.get("benefits")):
                seen[sid] = {**existing, **{k: v for k, v in s.items() if v}}
    return list(seen.values())


# ─────────────────────────────────────────────────────────────────────────────
# Supabase upsert
# ─────────────────────────────────────────────────────────────────────────────

def upsert_to_supabase(schemes: list[dict], dry_run: bool = False) -> dict:
    if dry_run:
        print(f"\n[DRY RUN] Would upsert {len(schemes)} schemes.")
        for s in schemes[:5]:
            print(f"  • {s['id']}: {s['name']}")
        if len(schemes) > 5:
            print(f"  … and {len(schemes)-5} more")
        return {"ok": True, "count": len(schemes), "dry_run": True}

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n⚠ SUPABASE_URL / key not set — skipping DB upsert.")
        print("  Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.")
        return {"ok": False, "error": "Not configured"}

    try:
        from supabase import create_client
    except ImportError:
        print("\n⚠ supabase-py not installed. Run: pip install supabase")
        return {"ok": False, "error": "supabase not installed"}

    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    now = datetime.now(timezone.utc).isoformat()

    # Detect whether new columns exist
    has_new_cols = True
    try:
        test = {"id": "_col_probe", "name": "probe", "category": "general",
                "source": "builtin", "state_specific": False}
        client.table("schemes").upsert(test, on_conflict="id").execute()
        client.table("schemes").delete().eq("id", "_col_probe").execute()
    except Exception:
        has_new_cols = False
        print("  ⚠ New schema columns (source/state_specific/scraped_at) not found.")
        print("    Run the SQL migration in Supabase to add them:")
        print("    ALTER TABLE schemes ADD COLUMN IF NOT EXISTS source text DEFAULT 'builtin';")
        print("    ALTER TABLE schemes ADD COLUMN IF NOT EXISTS state_specific boolean NOT NULL DEFAULT false;")
        print("    ALTER TABLE schemes ADD COLUMN IF NOT EXISTS scraped_at timestamptz;")
        print("    → Continuing without them.\n")

    rows = []
    for s in schemes:
        row: dict[str, Any] = {
            "id":               s["id"],
            "name":             s["name"],
            "category":         s.get("category", "general"),
            "description":      s.get("description"),
            "benefits":         s.get("benefits"),
            "eligibility_text": s.get("eligibility_text"),
            "rules":            s.get("rules", {}),
            "ministry":         s.get("ministry"),
            "official_url":     s.get("official_url"),
            "is_active":        True,
        }
        # Only include new columns if they exist in the schema
        # (they are added by running schema.sql — safe to exclude if missing)
        if has_new_cols:
            row["source"]         = s.get("source", "scraped")
            row["state_specific"] = s.get("state_specific", False)
            row["scraped_at"]     = now
        rows.append(row)

    # Upsert in batches of 50
    total_ok = 0
    errors = []
    for i in range(0, len(rows), 50):
        batch = rows[i: i + 50]
        try:
            res = client.table("schemes").upsert(batch, on_conflict="id").execute()
            total_ok += len(batch)
            print(f"  ✓ Upserted batch {i//50 + 1} ({len(batch)} rows)")
        except Exception as e:
            msg = str(e)
            errors.append(msg)
            print(f"  ✗ Batch {i//50 + 1} error: {msg}")

    print(f"\n✅ Upserted {total_ok}/{len(rows)} schemes to Supabase.")
    return {"ok": len(errors) == 0, "count": total_ok, "errors": errors}


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CIVIS AI — Government Scheme Scraper")
    parser.add_argument("--source", default="all",
                        choices=["all", "builtin", "myscheme", "pmindia"],
                        help="Which source(s) to scrape (default: all)")
    parser.add_argument("--limit", type=int, default=50,
                        help="Max schemes to fetch per source (default: 50)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print results without saving to Supabase")
    parser.add_argument("--json-output", action="store_true",
                        help="Output scraped schemes as JSON to stdout (for API use, skips DB write)")
    args = parser.parse_args()

    # In JSON output mode, redirect ALL progress prints to stderr BEFORE any
    # print() calls, so that stdout only contains the final clean JSON result.
    _real_stdout = sys.stdout
    if args.json_output:
        sys.stdout = sys.stderr

    print("=" * 60)
    print("  CIVIS AI — Government Scheme Scraper")
    print(f"  Source: {args.source}  |  Limit: {args.limit}  |  Dry-run: {args.dry_run}")
    print("=" * 60)

    all_schemes: list[dict] = []

    if args.source in ("all", "builtin"):
        print(f"\n[Built-in dataset] Loading {len(BUILTIN_SCHEMES)} verified schemes…")
        all_schemes.extend(BUILTIN_SCHEMES)
        print(f"  → Loaded {len(BUILTIN_SCHEMES)} built-in schemes ✓")

    if args.source in ("all", "myscheme"):
        scraped = scrape_myscheme(limit=args.limit)
        all_schemes.extend(scraped)

    if args.source in ("all", "pmindia"):
        scraped = scrape_pmindia(limit=args.limit)
        all_schemes.extend(scraped)

    # Deduplicate
    unique = deduplicate(all_schemes)
    print(f"\n📋 Total unique schemes: {len(unique)} (from {len(all_schemes)} collected)")

    # Show category breakdown
    cats: dict[str, int] = {}
    for s in unique:
        cats[s.get("category", "general")] = cats.get(s.get("category", "general"), 0) + 1
    print("\nCategory breakdown:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat:20s}: {count}")

    # JSON output mode — emit clean JSON to stdout and exit (no DB write)
    if args.json_output:
        sys.stdout = _real_stdout  # restore real stdout
        print(json.dumps({"ok": True, "schemes": unique, "count": len(unique)}, ensure_ascii=False))
        return

    # Upsert
    result = upsert_to_supabase(unique, dry_run=args.dry_run)

    if result.get("ok"):
        print(f"\n🎉 Done! {result['count']} schemes {'would be ' if args.dry_run else ''}saved.")
    else:
        print(f"\n⚠ Finished with errors: {result.get('errors', [])}")
        sys.exit(1)


if __name__ == "__main__":
    main()
