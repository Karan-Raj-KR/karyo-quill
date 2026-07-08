from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import json
import re
import io
import time
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Literal, Optional
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection (kept for environment compliance; not used by Quill)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM configuration
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
USE_LLM = os.environ.get("USE_LLM", "true").strip().lower() == "true"
LLM_MODEL = "claude-sonnet-4-5-20250929"
LLM_TIMEOUT_S = 25.0

# Microphone / Whisper configuration
ENABLE_MIC = os.environ.get("ENABLE_MIC", "true").strip().lower() == "true"
WHISPER_MODEL = "whisper-1"
WHISPER_TIMEOUT_S = 60.0
MAX_AUDIO_BYTES = 15 * 1024 * 1024  # 15 MB
MIN_AUDIO_BYTES = 1024  # < 1 KB is almost certainly empty/too short

# mimetype → file extension hint for Whisper (Whisper detects from filename ext)
AUDIO_EXT_BY_MIME = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
}

# Create the main app without a prefix.
# Expose OpenAPI under /api so it's reachable through the ingress
# (the ingress only routes /api/* to the backend).
app = FastAPI(
    title="Quill API",
    version="0.1.0",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


QUILL_SEEDS = {
    "clinical": {
        "documentTitle": "Clinical Note — Acute Pharyngitis",
        "sections": [
            {"heading": "Subjective", "content": "Patient reports sore throat, fever, and productive cough for 3 days. Denies dyspnea. Reports fatigue."},
            {"heading": "Objective", "content": "Temp 38.6°C. Oropharynx erythematous with tonsillar swelling. Lungs clear to auscultation bilaterally. Blood pressure not recorded this visit."},
            {"heading": "Assessment", "content": "Likely bacterial pharyngitis (streptococcal vs viral). Consider rapid strep test."},
            {"heading": "Plan", "content": "Empiric antibiotics. Supportive care: hydration, rest, antipyretics PRN. Return if symptoms worsen or persist beyond 7 days."},
            {"heading": "ICD-10 Codes", "content": "J02.9 — Acute pharyngitis, unspecified; R50.9 — Fever, unspecified"},
        ],
        "suggestions": [
            {"label": "Amoxicillin", "detail": "500 mg PO TID for 10 days. Take with food."},
            {"label": "Paracetamol", "detail": "500 mg PO QID PRN for fever or pain. Max 4g/day."},
            {"label": "Throat lozenges", "detail": "1 lozenge every 2–3 hours PRN for sore throat."},
        ],
        "flags": [
            "Blood pressure not recorded",
            "Allergy history not asked — confirm before prescribing amoxicillin",
            "Possible drug interaction risk if patient is on warfarin",
        ],
        "exportLabel": "Print prescription",
    },
}


# --- Per-mode hard rules (used both for prompting and validation) ---

MODE_RULES = {
    "clinical": {
        "exportLabel": "Print prescription",
        "required_sections": ["Subjective", "Objective", "Assessment", "Plan", "ICD-10 Codes"],
    },
}


# --- LLM system prompt ---

QUILL_SYSTEM_PROMPT = """You are a clinical documentation assistant for medical doctors. \
Convert the doctor-patient conversation transcript into a structured clinical note DRAFT for a doctor to review and approve. \
You suggest; you never decide. Return ONLY valid JSON in the schema — no prose, no markdown.

JSON schema (EXACT keys, no extras):
{
  "documentTitle": "string",
  "sections": [ { "heading": "string", "content": "string" } ],
  "suggestions": [ { "label": "string", "detail": "string" } ],
  "flags": [ "string" ],
  "exportLabel": "string"
}

Clinical Mode Hard Rules:
- sections MUST be exactly these headings, in order: "Subjective", "Objective", "Assessment", "Plan", "ICD-10 Codes".
- The "ICD-10 Codes" section MUST contain at least one valid ICD-10 code formatted like "J02.9 — Acute pharyngitis, unspecified" (semicolon-separate multiple codes).
- suggestions are medications: label = drug name; detail = dose + frequency + instructions (e.g. "500 mg PO TID for 10 days. Take with food.").
- flags MUST call out, where applicable: missing vital signs (e.g. blood pressure), unasked allergy history, and any drug interaction risks based on the transcript.
- exportLabel MUST be exactly "Print prescription".
- documentTitle is a short, scannable title (e.g. "Clinical Note — Acute Pharyngitis").
- Keep section content concise (1–4 sentences) but specific to what was said.
- If something was not discussed, say so explicitly (e.g. "Not discussed on this call.") AND add a flag.
- Output ONLY the JSON object. No code fences, no preamble, no trailing commentary."""


def _extract_json(text: str) -> Optional[dict]:
    """Pull a JSON object out of an LLM response that may be fenced or padded."""
    if not text:
        return None
    s = text.strip()
    # Strip ```json ... ``` or ``` ... ``` fences if present
    if s.startswith("```"):
        s = re.sub(r"^```(?:json|JSON)?\s*", "", s)
        s = re.sub(r"\s*```\s*$", "", s)
        s = s.strip()
    # Direct parse
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    # Fallback: locate outermost { ... }
    first = s.find("{")
    last = s.rfind("}")
    if first != -1 and last > first:
        try:
            return json.loads(s[first:last + 1])
        except json.JSONDecodeError:
            return None
    return None


def _validate_schema(data, mode: str) -> bool:
    """Strict schema + per-mode validation. Returns True only if all rules pass."""
    if not isinstance(data, dict):
        return False
    required_keys = ("documentTitle", "sections", "suggestions", "flags", "exportLabel")
    if not all(k in data for k in required_keys):
        return False
    if not isinstance(data["documentTitle"], str) or not data["documentTitle"].strip():
        return False

    sections = data["sections"]
    if not isinstance(sections, list) or not sections:
        return False
    for s in sections:
        if not isinstance(s, dict):
            return False
        if not isinstance(s.get("heading"), str) or not s["heading"].strip():
            return False
        if not isinstance(s.get("content"), str):
            return False

    suggestions = data["suggestions"]
    if not isinstance(suggestions, list):
        return False
    for sg in suggestions:
        if not isinstance(sg, dict):
            return False
        if not isinstance(sg.get("label"), str) or not sg["label"].strip():
            return False
        if not isinstance(sg.get("detail"), str):
            return False

    flags = data["flags"]
    if not isinstance(flags, list):
        return False
    if any(not isinstance(f, str) for f in flags):
        return False

    rules = MODE_RULES[mode]

    if data["exportLabel"] != rules["exportLabel"]:
        return False

    # Required headings must all be present (case-insensitive)
    heading_set = {s["heading"].strip().lower() for s in sections}
    required = {h.lower() for h in rules["required_sections"]}
    if not required.issubset(heading_set):
        return False

    return True


async def _call_llm(transcript: str, mode: str) -> Optional[dict]:
    """Call Claude Sonnet 4.5 via the Emergent universal LLM key.

    Returns the parsed+validated dict on success, or None on any failure
    (no key, timeout, exception, non-JSON output, schema violation).
    Logs the fallback reason server-side; never raises to the caller.
    """
    if not EMERGENT_LLM_KEY:
        logger.warning("LLM disabled: EMERGENT_LLM_KEY not set; using seed fallback")
        return None

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"quill-{uuid.uuid4()}",
            system_message=QUILL_SYSTEM_PROMPT,
        ).with_model("anthropic", LLM_MODEL)

        user_message = UserMessage(
            text=f"Mode: {mode}\n\nTranscript:\n{transcript}\n\nReturn ONLY the JSON object."
        )

        raw = await asyncio.wait_for(
            chat.send_message(user_message),
            timeout=LLM_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        logger.warning("LLM timeout after %.1fs (mode=%s); using seed fallback", LLM_TIMEOUT_S, mode)
        return None
    except Exception as exc:  # noqa: BLE001 — transparent fallback by design
        logger.warning("LLM call failed (mode=%s): %s; using seed fallback", mode, exc)
        return None

    raw_text = raw if isinstance(raw, str) else str(raw)
    parsed = _extract_json(raw_text)
    if parsed is None:
        logger.warning(
            "LLM response was not parseable JSON (mode=%s); using seed fallback. raw[:300]=%r",
            mode, raw_text[:300],
        )
        return None
    if not _validate_schema(parsed, mode):
        logger.warning(
            "LLM JSON failed schema/mode validation (mode=%s); using seed fallback",
            mode,
        )
        return None
    return parsed


# --- Models ---

class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transcript: str
    mode: Literal["clinical"]


class SectionModel(BaseModel):
    heading: str
    content: str


class SuggestionModel(BaseModel):
    label: str
    detail: str


class GenerateResponse(BaseModel):
    documentTitle: str
    sections: List[SectionModel]
    suggestions: List[SuggestionModel]
    flags: List[str]
    exportLabel: str


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


# --- Routes ---

@api_router.get("/")
async def root():
    return {"message": "Quill API — Phase 3", "version": "0.3.0"}


@api_router.get("/config")
async def config():
    """Feature flags exposed to the frontend (no secrets)."""
    return {
        "enableMic": ENABLE_MIC,
    }


@api_router.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    """
    Phase 2: call Claude Sonnet 4.5 via the Emergent universal LLM key.
    On any failure (LLM disabled, timeout, exception, non-JSON output, or
    schema/mode validation failure) fall back transparently to the
    mode-matched hardcoded seed JSON with HTTP 200 — the UI must never
    break in front of a user.
    """
    transcript = (req.transcript or "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript must not be empty.")

    seed = QUILL_SEEDS.get(req.mode)
    if seed is None:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {req.mode}")

    if USE_LLM:
        llm_result = await _call_llm(transcript, req.mode)
        if llm_result is not None:
            logger.info("LLM generate OK (mode=%s)", req.mode)
            return llm_result
        logger.info("LLM unavailable/invalid (mode=%s); returning seed", req.mode)
    else:
        logger.info("USE_LLM=false; returning seed (mode=%s)", req.mode)

    return seed


@api_router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    mimeType: str = Form(default=""),
):
    """
    Phase 3: transcribe an uploaded audio recording via OpenAI Whisper
    (whisper-1) using the Emergent universal LLM key.

    Request: multipart/form-data
        - audio: file (webm/opus, mp4/m4a, wav, mp3, ogg, …; 7 formats supported upstream)
        - mimeType: string (optional client hint; defaults to UploadFile.content_type)

    Response: 200 {"text": "<transcript>"}
    Errors:
        - 503 if microphone feature is disabled (ENABLE_MIC=false)
        - 413 if audio > 15 MB
        - 400 if audio < 1 KB (too short / empty)
        - 502 on any upstream Whisper failure (timeout / API error / bad format)

    Privacy: the audio bytes are NOT persisted to disk or DB. They live in memory
    only for the duration of the Whisper call.
    """
    if not ENABLE_MIC:
        raise HTTPException(status_code=503, detail="Microphone transcription is disabled.")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=502, detail="Transcription service is not configured.")

    raw = await audio.read()
    size = len(raw)
    if size > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio exceeds 15 MB limit (got {size // (1024 * 1024)} MB).",
        )
    if size < MIN_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="Audio is too short to transcribe.")

    # Resolve a filename extension Whisper can recognize. Prefer the client-supplied
    # mimeType, then UploadFile.content_type, then default to webm (browser default).
    client_mime = (mimeType or audio.content_type or "audio/webm").split(";")[0].strip().lower()
    ext = AUDIO_EXT_BY_MIME.get(client_mime, "webm")

    # Build a file-like object with a proper filename so Whisper can sniff the format.
    buf = io.BytesIO(raw)
    buf.name = f"recording.{ext}"

    t0 = time.time()
    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        resp = await asyncio.wait_for(
            stt.transcribe(
                file=buf,
                model=WHISPER_MODEL,
                response_format="json",
            ),
            timeout=WHISPER_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        logger.warning("Whisper timed out after %.1fs (bytes=%d ext=%s)", WHISPER_TIMEOUT_S, size, ext)
        raise HTTPException(status_code=502, detail="Transcription timed out. Please try again with a shorter clip.")
    except Exception as exc:  # noqa: BLE001 — surface failure to client per brief
        logger.warning("Whisper failed (bytes=%d ext=%s mime=%s): %s", size, ext, client_mime, exc)
        raise HTTPException(status_code=502, detail="Couldn't transcribe — try again.")
    finally:
        # Audio is never persisted: drop the buffer + uploaded bytes ASAP.
        buf.close()
        raw = b""

    text = getattr(resp, "text", None)
    if not isinstance(text, str):
        # Some response wrappers expose .json() / dict — handle defensively.
        try:
            text = resp["text"] if isinstance(resp, dict) else str(resp)
        except Exception:
            text = ""
    text = (text or "").strip()

    elapsed = time.time() - t0
    logger.info(
        "Whisper OK: bytes=%d ext=%s latency=%.2fs chars=%d",
        size, ext, elapsed, len(text),
    )
    return {"text": text}


# Status check endpoints retained (template heritage; harmless)
@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(payload: StatusCheckCreate):
    status_obj = StatusCheck(**payload.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
