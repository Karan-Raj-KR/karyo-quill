"""Backend tests for Quill — Phase 2 (LLM-backed /api/generate).

The endpoint now calls Claude Sonnet 4.5 via the Emergent universal LLM key
and falls back transparently to seed JSON on any failure. Tests therefore
validate the contract (schema + per-mode rules), not exact wording.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get(
    'REACT_APP_BACKEND_URL',
    'https://60bee4db-1587-4972-adf9-3767282adb23.preview.emergentagent.com',
).rstrip('/')

EXPECTED_EXPORT_LABELS = {
    "clinical": "Print prescription",
    "sales": "Copy follow-up email",
    "interview": "Export scorecard",
    "intake": "Export brief",
}

REQUIRED_HEADINGS = {
    "clinical": {"subjective", "objective", "assessment", "plan", "icd-10 codes"},
    "sales": {"needs", "budget", "timeline", "stakeholders", "summary"},
    "interview": {"experience", "key skills", "culture fit", "overall"},
    "intake": {"goals", "deliverables", "budget", "timeline", "scope"},
}

# Phase 1 sample transcripts (used to verify the LLM catches planted gaps).
SAMPLES = {
    "clinical": (
        "Doctor: Morning — what brings you in today?\n"
        "Patient: Sore throat and fever for three days, and a bad cough.\n"
        "Doctor: Any trouble breathing?\n"
        "Patient: No, just the cough, and I'm really tired.\n"
        "Doctor: Let me look… throat's quite red, tonsils swollen. Temp is 38.6. Chest is clear.\n"
        "Doctor: Looks like a bacterial throat infection. I'll start you on antibiotics — fluids and rest.\n"
        "Patient: Okay, thank you."
    ),
    "sales": (
        "Rep: Thanks for hopping on — what's prompting you to look at a new tool now?\n"
        "Prospect: Our CRM is clunky and the team hates logging calls.\n"
        "Rep: How big is the team?\n"
        "Prospect: About 20 reps.\n"
        "Rep: What does success look like in six months?\n"
        "Prospect: Honestly, reps actually using it. We've tried two tools already.\n"
        "Rep: Who else is involved in the decision?\n"
        "Prospect: Me and our VP of Sales.\n"
        "Rep: Great — I'll send some info over."
    ),
    "interview": (
        "Interviewer: Walk me through your last role.\n"
        "Candidate: Backend engineer for three years — Python and Postgres, led a team of four on a payments service.\n"
        "Interviewer: Hardest problem you solved?\n"
        "Candidate: A race condition causing double charges. I redesigned the locking — dropped to zero.\n"
        "Interviewer: How do you like to work with a team?\n"
        "Candidate: Lots of autonomy, heavy code review.\n"
        "Interviewer: Great, that's all my questions."
    ),
    "intake": (
        "Us: What are you hoping to achieve?\n"
        "Client: New cafe — we need to get found online and start getting orders.\n"
        "Us: On Zomato and Swiggy yet?\n"
        "Client: No, nothing set up.\n"
        "Us: Do you have a logo and brand colors?\n"
        "Client: Just a logo.\n"
        "Us: Timeline?\n"
        "Client: We open in three weeks.\n"
        "Us: Perfect — we'll put a plan together."
    ),
}


@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- /api/openapi.json ---
class TestOpenAPI:
    def test_openapi_accessible(self, session):
        r = session.get(f"{BASE_URL}/api/openapi.json", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "paths" in data
        assert "/api/generate" in data["paths"]


# --- /api/generate per-mode (schema + contract) ---
class TestGenerateModes:
    @pytest.mark.parametrize("mode", ["clinical", "sales", "interview", "intake"])
    def test_generate_schema(self, session, mode):
        r = session.post(
            f"{BASE_URL}/api/generate",
            json={"transcript": SAMPLES[mode], "mode": mode},
            timeout=45,
        )
        assert r.status_code == 200, r.text
        data = r.json()

        # schema shape
        assert isinstance(data.get("documentTitle"), str) and data["documentTitle"].strip()
        assert isinstance(data.get("sections"), list) and data["sections"]
        for s in data["sections"]:
            assert isinstance(s.get("heading"), str)
            assert isinstance(s.get("content"), str)
        assert isinstance(data.get("suggestions"), list) and data["suggestions"]
        for s in data["suggestions"]:
            assert isinstance(s.get("label"), str)
            assert isinstance(s.get("detail"), str)
        assert isinstance(data.get("flags"), list) and data["flags"]
        assert all(isinstance(f, str) for f in data["flags"])

        # per-mode rules
        assert data["exportLabel"] == EXPECTED_EXPORT_LABELS[mode]
        headings = {s["heading"].strip().lower() for s in data["sections"]}
        missing = REQUIRED_HEADINGS[mode] - headings
        assert not missing, f"missing required headings for {mode}: {missing}"

    def test_clinical_flags_call_out_risk(self, session):
        """Clinical sample omits BP, allergy history, and prescribes amoxicillin.
        The LLM (or seed fallback) must surface at least one drug/allergy/interaction concern."""
        r = session.post(
            f"{BASE_URL}/api/generate",
            json={"transcript": SAMPLES["clinical"], "mode": "clinical"},
            timeout=45,
        )
        assert r.status_code == 200
        joined = " ".join(r.json()["flags"]).lower()
        assert any(k in joined for k in ("interaction", "drug", "allergy", "allerg")), \
            f"clinical flags must mention drug/allergy/interaction risk; got: {joined}"

    def test_sales_flags_call_out_budget_or_next_step(self, session):
        r = session.post(
            f"{BASE_URL}/api/generate",
            json={"transcript": SAMPLES["sales"], "mode": "sales"},
            timeout=45,
        )
        assert r.status_code == 200
        joined = " ".join(r.json()["flags"]).lower()
        assert "budget" in joined or "next step" in joined, \
            f"sales flags must mention budget or next step; got: {joined}"

    def test_interview_flags_call_out_salary_or_notice(self, session):
        r = session.post(
            f"{BASE_URL}/api/generate",
            json={"transcript": SAMPLES["interview"], "mode": "interview"},
            timeout=45,
        )
        assert r.status_code == 200
        joined = " ".join(r.json()["flags"]).lower()
        assert "salary" in joined or "notice" in joined or "availability" in joined, \
            f"interview flags must mention salary/notice/availability; got: {joined}"

    def test_intake_flags_call_out_budget_or_metric(self, session):
        r = session.post(
            f"{BASE_URL}/api/generate",
            json={"transcript": SAMPLES["intake"], "mode": "intake"},
            timeout=45,
        )
        assert r.status_code == 200
        joined = " ".join(r.json()["flags"]).lower()
        assert "budget" in joined or "success" in joined or "metric" in joined, \
            f"intake flags must mention budget or success metric; got: {joined}"


# --- validation ---
class TestGenerateValidation:
    def test_empty_transcript_returns_400(self, session):
        r = session.post(
            f"{BASE_URL}/api/generate",
            json={"transcript": "", "mode": "clinical"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_whitespace_transcript_returns_400(self, session):
        r = session.post(
            f"{BASE_URL}/api/generate",
            json={"transcript": "   \n  \t  ", "mode": "clinical"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_invalid_mode_returns_422(self, session):
        r = session.post(
            f"{BASE_URL}/api/generate",
            json={"transcript": "hello", "mode": "bogus"},
            timeout=15,
        )
        assert r.status_code == 422


# --- latency (real LLM call, plus seed-fallback under 1s) ---
class TestLatency:
    def test_generate_completes_within_window(self, session):
        t0 = time.time()
        r = session.post(
            f"{BASE_URL}/api/generate",
            json={"transcript": SAMPLES["clinical"], "mode": "clinical"},
            timeout=45,
        )
        elapsed = time.time() - t0
        assert r.status_code == 200
        # LLM ~8-15s; seed fallback <1s. Either is fine, just not the 25s timeout boundary.
        assert elapsed < 30.0, f"Too slow: {elapsed:.3f}s"
