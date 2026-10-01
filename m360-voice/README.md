# M360 Voice Module

The one voice m360 OS speaks with, and the ears it listens through. Everything here is open source and
licensed for commercial use.

| Job | Model | Licence |
|---|---|---|
| Speak English | Chatterbox Turbo (Resemble AI, 350M) | MIT |
| Speak Hindi, Arabic and 21 more | Chatterbox Multilingual V3 (500M) | MIT |
| Listen | Whisper large-v3-turbo via faster-whisper | MIT |

Do not swap in Breeze TTS 2, Fish Audio S2 Pro, Voxtral TTS, Higgs Audio V3 or XTTS v2. Their weights are
non-commercial.

## How it reaches the OS

The OS stays on EdgeOne. The EdgeOne function (`m360-os/edgeone/server/voice.js`) is the only thing that
talks to this box, with the key held in the function's environment, so the browser calls its own origin
(`/api/m360`, actions `speak` and `listen`) and the key never reaches a page. Set these on the EdgeOne
project (or save them from Admin > Controls > Super > Voice box):

```
VOICE_URL=https://voice.mask360.agency
VOICE_API_KEY=<the same long random string the box runs with>
VOICE_NAME=m360
```

Browsers only allow the microphone on HTTPS; the OS is already on HTTPS, and the box needs HTTPS in front
of it too (Caddy, or a Cloudflare tunnel on a subdomain such as voice.mask360.agency) so the function can
reach it.

The claude.ai artifact cannot reach outside servers, so voice is a site-only feature there: the artifact
falls back to the browser's own voices and speech recognition.

## 1. Box

One NVIDIA GPU with 16GB VRAM to be safe (RunPod, or E2E Networks Mumbai for India latency). Ubuntu,
Python 3.11. Model weights download from Hugging Face on first boot and stay cached after that.

No GPU: set `EN_ENGINE=nano` (110M, runs on CPU) and `LOAD_MULTILINGUAL=0`. English only, slower.

## 2. Install

```bash
cd m360-voice
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Pin `av` below 17. PyAV 19 breaks faster-whisper's audio decoder. Install chatterbox from the GitHub repo:
the PyPI package is behind and lacks Multilingual V3 and Nano.

## 3. Run

```bash
export VOICE_API_KEY="make-a-long-random-string"
export WHISPER_HINTS="Mask360, M360, Kaavish"      # add client and team names so Whisper spells them right
export ALLOWED_ORIGINS="https://m360os-wx9u1bqs.edgeone.dev"
uvicorn server:app --host 0.0.0.0 --port 8000
```

If faster-whisper cannot find CUDA libraries on the GPU box:

```bash
export LD_LIBRARY_PATH=$(python3 -c 'import os, nvidia.cublas.lib, nvidia.cudnn.lib; print(os.path.dirname(nvidia.cublas.lib.__file__) + ":" + os.path.dirname(nvidia.cudnn.lib.__file__))')
```

## 4. Test

```bash
K="Authorization: Bearer $VOICE_API_KEY"
curl -s localhost:8000/health
curl -s -X POST localhost:8000/v1/audio/speech -H "$K" -H 'Content-Type: application/json' \
  -d '{"input":"Good morning team. Three pitches are due today [chuckle]."}' -o en.wav
curl -s -X POST localhost:8000/v1/audio/speech -H "$K" -H 'Content-Type: application/json' \
  -d '{"input":"नमस्ते, आज तीन पिच हैं।","language":"hi"}' -o hi.wav
curl -s -X POST localhost:8000/v1/audio/transcriptions -H "$K" -F file=@en.wav
```

## 5. Set the m360 voice

Record 10 seconds of one clear speaker, no music, no room echo. Only use a voice you have consent for.
Upload once; it persists in `./voices` and reloads on restart.

```bash
curl -s -X POST localhost:8000/v1/voices -H "$K" -F name=m360 -F file=@m360_voice.wav
```

## Done when

1. `/health` shows `device: cuda`, `multilingual: true`, voice `m360` listed.
2. en.wav and hi.wav play clean in the m360 voice.
3. In the OS: hold the buddy (or tap Talk in Ask), ask a question, hear the answer start within about a second.
