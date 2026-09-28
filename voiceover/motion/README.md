# m360 demo film: motion design

The film for `../m360-demo-voiceover.md`, built in m360's own design system (paper, ink, one flame accent, Space Grotesk, the m360 mark and the flame buddy).
It is one HTML page (`index.html`) whose every frame is a function of time, rendered to MP4 by `render.py`.

- **Watch it live:** open `index.html` in Chrome. `index.html?t=120` starts at 2:00; `?t=120&still` freezes there.
- **Render:** `pip install playwright imageio-ffmpeg`, then `python3 render.py` writes `out/m360-demo.mp4` (1920x1080, 30 fps).
- **With the voiceover:** `python3 render.py --audio vo.mp3` also writes `out/m360-demo-with-voiceover.mp4`.

## Syncing to the ElevenLabs audio

Every scene has a length and the word count of each line of its script (`SCENES_T` at the top of the script in `index.html`).
The animation beats land on the lines in proportion, so each scene only needs its real length:

1. Generate each scene as its own clip in ElevenLabs (the script is already split by scene).
2. Put each clip's length in seconds into `dur` for that scene.
3. Join the clips into one file in order and render with `--audio`.

| # | Scene | Default length |
|---|---|---|
| 1 | The hook: Friday 7:40 pm | 24.0 s |
| 2 | So I built m360 | 19.0 s |
| 3 | Riya's day, the blocker flags itself | 34.0 s |
| 4 | Four fixed moments | 31.0 s |
| 5 | It's gamified | 45.0 s |
| 6 | The vibe | 45.5 s |
| 7 | Clients, Radar, Hunt, Base | 41.0 s |
| 8 | The buddy | 22.0 s |
| 9 | The founder's view | 23.0 s |
| 10 | Close | 12.0 s |

Names (Riya, Arjun, Meher, Kabir, Tanvi) and the client Tara Foods are made up for the demo.
