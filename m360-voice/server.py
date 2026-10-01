"""
M360 Voice Module
Speaks:  Chatterbox Turbo (English, fastest) + Chatterbox Multilingual V3 (Hindi, Arabic + 21 more). MIT licence.
Listens: Whisper large-v3-turbo via faster-whisper. MIT licence.
Endpoints copy the OpenAI audio API, so any OpenAI-style client works against it.
Run: uvicorn server:app --host 0.0.0.0 --port 8000
"""
import io, os, re, asyncio, tempfile, pathlib

import torch
import soundfile as sf
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Depends
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from chatterbox.tts_turbo import ChatterboxTurboTTS
from chatterbox.mtl_tts import SUPPORTED_LANGUAGES

# ---------- config (env vars) ----------
DEVICE = os.getenv("DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
API_KEY = os.getenv("VOICE_API_KEY", "")                 # empty = no auth (local testing only)
EN_ENGINE = os.getenv("EN_ENGINE", "turbo")              # turbo (GPU) | nano (CPU box)
LOAD_MTL = os.getenv("LOAD_MULTILINGUAL", "1") == "1"    # Hindi, Arabic and the other 21 languages
WHISPER = os.getenv("WHISPER_MODEL", "large-v3-turbo")
WHISPER_HINTS = os.getenv("WHISPER_HINTS", "Mask360, M360, Kaavish")  # names Whisper should spell right
VOICES_DIR = pathlib.Path(os.getenv("VOICES_DIR", "voices")); VOICES_DIR.mkdir(exist_ok=True)
OS_DIR = os.getenv("OS_DIR", "os")                       # put the M360 OS build here to serve it from this box
ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

# ---------- load models once ----------
en = ChatterboxTurboTTS.from_pretrained(device=DEVICE, nano=(EN_ENGINE == "nano"))
mtl = None
if LOAD_MTL:
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    mtl = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE, t3_model="v3")
stt = WhisperModel(WHISPER, device="cuda" if DEVICE == "cuda" else "cpu",
                   compute_type="float16" if DEVICE == "cuda" else "int8")

# voice bank: each saved voice is prepared once per model, then swapped in per request
bank = {"en": {"default": en.conds}, "mtl": {"default": mtl.conds if mtl else None}}

def _prepare(name: str, path: pathlib.Path):
    en.prepare_conditionals(str(path), exaggeration=0.0)
    bank["en"][name] = en.conds
    if mtl:
        mtl.prepare_conditionals(str(path), exaggeration=0.5)
        bank["mtl"][name] = mtl.conds
    en.conds = bank["en"]["default"]
    if mtl:
        mtl.conds = bank["mtl"]["default"]

for wav in sorted(VOICES_DIR.glob("*.wav")):
    _prepare(wav.stem, wav)

tts_lock, stt_lock = asyncio.Lock(), asyncio.Lock()

# ---------- helpers ----------
def chunk(text: str, limit: int = 280):
    """Split long replies at sentence ends (. ! ? plus Hindi and Arabic stops) so each piece stays stable."""
    text = re.sub(r"\s+", " ", text).strip()
    out, cur = [], ""
    for part in re.split(r"(?<=[.!?\u0964\u061F])\s+", text):
        if len(cur) + len(part) + 1 <= limit:
            cur = f"{cur} {part}".strip()
            continue
        if cur:
            out.append(cur)
        while len(part) > limit:
            cut = part.rfind(",", 0, limit)
            cut = cut if cut > 80 else part.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            out.append(part[:cut + 1].strip())
            part = part[cut + 1:].strip()
        cur = part
    if cur:
        out.append(cur)
    return out

def _synth(text: str, voice: str, lang: str) -> bytes:
    use_en = lang == "en"
    model = en if use_en else mtl
    if model is None:
        raise HTTPException(400, "Multilingual model not loaded. Set LOAD_MULTILINGUAL=1.")
    voices = bank["en" if use_en else "mtl"]
    if voice not in voices:
        raise HTTPException(404, f"Voice '{voice}' not found. Saved voices: {sorted(voices)}")
    model.conds = voices[voice]
    gap = torch.zeros(1, int(model.sr * 0.18))
    pieces = []
    for piece in chunk(text):
        wav = model.generate(piece) if use_en else model.generate(piece, language_id=lang)
        pieces += [wav.detach().cpu(), gap]
    audio = torch.cat(pieces[:-1], dim=1).squeeze(0).numpy()
    buf = io.BytesIO()
    sf.write(buf, audio, model.sr, format="WAV")
    return buf.getvalue()

def auth(authorization: str | None = Header(None)):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(401, "Missing or wrong VOICE_API_KEY")

# ---------- app ----------
app = FastAPI(title="M360 Voice Module")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])

class SpeechRequest(BaseModel):
    input: str
    voice: str = "default"
    language: str = "en"            # en | hi | ar | any code in SUPPORTED_LANGUAGES
    model: str | None = None        # accepted for OpenAI compatibility, ignored
    response_format: str | None = "wav"

@app.get("/health")
def health():
    return {"ok": True, "device": DEVICE, "english_engine": EN_ENGINE, "multilingual": bool(mtl),
            "stt": WHISPER, "voices": sorted(bank["en"]), "languages": sorted(set(SUPPORTED_LANGUAGES) | {"en"})}

@app.post("/v1/audio/speech", dependencies=[Depends(auth)])
async def speech(req: SpeechRequest):
    lang = req.language.lower()
    if not req.input.strip():
        raise HTTPException(400, "Empty input")
    if lang != "en" and lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language '{lang}'")
    async with tts_lock:
        data = await asyncio.to_thread(_synth, req.input, req.voice, lang)
    return Response(data, media_type="audio/wav")

@app.post("/v1/audio/transcriptions", dependencies=[Depends(auth)])
async def transcriptions(file: UploadFile = File(...), language: str | None = Form(None),
                         model: str | None = Form(None)):
    suffix = pathlib.Path(file.filename or "in.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(await file.read())
        path = f.name
    def run():
        segments, info = stt.transcribe(path, language=language, vad_filter=True, beam_size=1,
                                        initial_prompt=WHISPER_HINTS or None)
        return " ".join(s.text.strip() for s in segments).strip(), info.language
    try:
        async with stt_lock:
            text, lang = await asyncio.to_thread(run)
    finally:
        os.unlink(path)
    return {"text": text, "language": lang}

@app.get("/v1/voices", dependencies=[Depends(auth)])
def list_voices():
    return {"voices": sorted(bank["en"])}

@app.post("/v1/voices", dependencies=[Depends(auth)])
async def add_voice(name: str = Form(...), file: UploadFile = File(...)):
    """Upload a clean 10 second clip (any format). Only clone voices you have consent for."""
    if not re.fullmatch(r"[a-z0-9_-]{1,40}", name):
        raise HTTPException(400, "Name: lowercase letters, numbers, - or _")
    suffix = pathlib.Path(file.filename or "in.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(await file.read())
        tmp = f.name
    try:
        audio = decode_audio(tmp, sampling_rate=24000)
    finally:
        os.unlink(tmp)
    seconds = len(audio) / 24000
    if seconds < 6:
        raise HTTPException(400, f"Clip is {seconds:.1f}s. Send 6 to 15 seconds of one clear speaker.")
    target = VOICES_DIR / f"{name}.wav"
    sf.write(target, audio[: 24000 * 15], 24000)
    async with tts_lock:
        await asyncio.to_thread(_prepare, name, target)
    return {"saved": name, "seconds": round(min(seconds, 15), 1)}

# serve the OS from the same box so the front end calls the voice API on its own origin
if os.path.isdir(OS_DIR):
    app.mount("/", StaticFiles(directory=OS_DIR, html=True), name="os")
