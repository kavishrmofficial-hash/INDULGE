# m360 demo films: motion design

Two films for the voiceover scripts in `../`, both built in m360's own design system and rendered from one HTML page whose every frame is a function of time.

| Film | Page | Script | Length | Look |
|---|---|---|---|---|
| The keynote cut | `keynote.html` | `../m360-keynote-90s.md` | about 85 s | dark keynote ground, the **real app screens** floating as windows, a camera that snaps into the card each line is about |
| The long walkthrough | `index.html` | `../m360-demo-voiceover.md` | about 5 min | redrawn screens in the design system |

## Render

```
pip install playwright imageio-ffmpeg pillow      # Chromium comes from PLAYWRIGHT_BROWSERS_PATH
FILM_PAGE=keynote.html FILM_NAME=m360-keynote-4k FILM_DPR=2 FILM_CRF=20 python3 render.py   # 4K, 30 fps
FILM_PAGE=keynote.html FILM_NAME=m360-keynote FILM_DPR=1 python3 render.py                  # 1080p
python3 render.py --audio vo.mp3                                                              # also lay the voiceover under the picture
FILM_PAGE=keynote.html python3 render.py --stills 8 20 40                                    # PNG stills for a look
```

Open a page in Chrome to watch it live; `keynote.html?t=30` starts at 0:30, `&still` freezes there.

## The real screens (`capture/`)

`capture/capture.py shots` builds m360 OS, runs it on the project's own QA harness (a mock `window.claude`, no server), seeds a demo week for a fictional team (Riya, Arjun, Meher, Kabir, Tanvi, a client called Tara Foods, so no real client or teammate appears in a film that goes outside), drives the real UI (mood, check in, the EOD line, Pursue from Radar, the buddy's tour, Cmd K) and screenshots each state at 3x into `capture/shots/`. It also measures where the cards are (`capture/shots/boxes.json`, copied to `boxes.js`), which is what the film's camera zooms to.

```
cd capture
python3 capture.py survey                     # every route, full page, to choose shots
CAP_DPR=3 CAP_TZ=America/Denver python3 capture.py shots   # the film's shots (the timezone makes it morning in the app)
python3 -c "import json;open('../boxes.js','w').write('const BOXES = '+json.dumps(json.load(open('shots/boxes.json')))+';\n')"
```

## Syncing to the ElevenLabs audio

`SCENES_T` at the top of each page holds one entry per line group of the script: its length in seconds and the word count of each line. The beats land on the lines in proportion, so each group only needs its real length. Time the groups from the voiceover clip (or generate one clip per group), put the seconds into `dur`, render with `--audio`.
