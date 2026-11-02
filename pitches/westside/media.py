"""Makes web versions of the reference videos: python3 pitches/westside/media.py <source folder> <output folder>

For each video it writes, without upscaling and capped at 4K and 30 fps:
- <slug>.av1.mp4   AV1, the small 4K file browsers that support AV1 play first
- <slug>.mp4       H.264, the fallback every browser plays, bitrate-capped
- <slug>.webp      a poster frame, so nothing loads until someone presses play
- review/<slug>.jpg  a contact sheet of six frames, for writing captions (not published)
and a manifest.json describing them all.
"""
import json, pathlib, re, subprocess, sys

VIDEO = {'.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'}
# poster frame times that avoid a logo under the play button or a large warm frame
POSTER_AT = {'whatsapp-video-2026-10-16-at-18-20-10': 4.0, 'whatsapp-video-2026-10-16-at-18-42-51-2': 12.0,
             'whatsapp-video-2026-10-16-at-18-20-25': 7.0, 'whatsapp-video-2026-10-16-at-18-42-50-2': 6.0,
             'whatsapp-video-2026-10-16-at-18-19-48': 5.0, 'whatsapp-video-2026-10-16-at-18-42-51-1': 6.0}
SRC, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'review').mkdir(exist_ok=True)


def run(*cmd):
    print('+', ' '.join(map(str, cmd)), flush=True)
    subprocess.run(list(map(str, cmd)), check=True)


def probe(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', str(p)],
                       check=True, capture_output=True, text=True)
    j = json.loads(r.stdout)
    v = next(s for s in j['streams'] if s['codec_type'] == 'video')
    rot = 0
    for sd in v.get('side_data_list', []):
        rot = int(sd.get('rotation', 0) or 0)
    rot = int(v.get('tags', {}).get('rotate', rot) or rot)
    w, h = int(v['width']), int(v['height'])
    if abs(rot) in (90, 270):
        w, h = h, w
    num, den = (v.get('avg_frame_rate') or '30/1').split('/')
    fps = float(num) / float(den or 1) if float(den or 1) else 30.0
    has_audio = any(s['codec_type'] == 'audio' for s in j['streams'])
    return w, h, fps, float(j['format'].get('duration', 0)), has_audio


def slugify(name):
    s = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return s[:60] or 'clip'


files = sorted(p for p in SRC.rglob('*') if p.suffix.lower() in VIDEO and not p.name.startswith('._'))
manifest, seen = [], set()
for p in files:
    w, h, fps, dur, has_audio = probe(p)
    slug = slugify(p.stem)
    while slug in seen:
        slug += '-2'
    seen.add(slug)
    portrait = h > w
    box_w, box_h = (2160, 3840) if portrait else (3840, 2160)
    scale = min(1.0, box_w / w, box_h / h)
    ow, oh = int(w * scale) // 2 * 2, int(h * scale) // 2 * 2
    ofps = min(30.0, fps) if fps > 0 else 30.0
    vf = f'scale={ow}:{oh}:flags=lanczos,fps={ofps:.3f},format=yuv420p'
    mpix = ow * oh / 1e6                       # 8.3 for 4K
    cap = max(1.5, min(6.0, 0.72 * mpix))      # H.264 Mbps cap: about 6 at 4K, 1.5 at 1080p
    audio = ['-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '48000'] if has_audio else ['-an']
    h264, av1, poster = OUT / f'{slug}.mp4', OUT / f'{slug}.av1.mp4', OUT / f'{slug}.webp'
    run('ffmpeg', '-y', '-v', 'error', '-i', p, '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-maxrate', f'{cap:.1f}M', '-bufsize', f'{2 * cap:.1f}M', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        *audio, '-movflags', '+faststart', h264)
    run('ffmpeg', '-y', '-v', 'error', '-i', p, '-vf', vf, '-c:v', 'libsvtav1', '-preset', '8', '-crf', '36',
        '-g', str(int(ofps * 8)), '-svtav1-params', f'mbr={int(cap * 600)}', '-pix_fmt', 'yuv420p',
        *audio, '-movflags', '+faststart', av1)
    at = POSTER_AT.get(slug, min(1.5, dur / 3) if dur else 0)
    run('ffmpeg', '-y', '-v', 'error', '-ss', f'{at:.2f}', '-i', p, '-frames:v', '1',
        '-vf', f'scale={min(1600, ow) if not portrait else -2}:{-2 if not portrait else min(1600, oh)}',
        '-c:v', 'libwebp', '-quality', '72', poster)
    step = max(dur / 7, 0.1)
    run('ffmpeg', '-y', '-v', 'error', '-i', p, '-vf',
        f'fps=1/{step:.3f},scale=480:-2,tile=6x1', '-frames:v', '1', '-q:v', '5', OUT / 'review' / f'{slug}.jpg')
    item = {
        'slug': slug, 'source': p.name, 'duration': round(dur, 2), 'width': ow, 'height': oh, 'fps': round(ofps, 3),
        'source_width': w, 'source_height': h, 'audio': has_audio,
        'bytes': {'h264': h264.stat().st_size, 'av1': av1.stat().st_size, 'poster': poster.stat().st_size},
    }
    manifest.append(item)
    print(json.dumps(item), flush=True)

(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1))
print(f'{len(manifest)} videos')
