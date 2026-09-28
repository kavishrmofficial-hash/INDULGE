"""Render the m360 demo film to MP4.

python3 render.py                      # the whole film, 30 fps, 1920x1080 -> out/m360-demo.mp4
python3 render.py --stills 5 40 90     # PNG stills at those seconds -> out/still-<t>.png
python3 render.py --audio vo.mp3       # also lay the voiceover under the picture

Needs: pip install playwright imageio-ffmpeg (Chromium comes from PLAYWRIGHT_BROWSERS_PATH).
"""
import argparse, os, subprocess, sys
from concurrent.futures import ProcessPoolExecutor
import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
URL = 'file://' + os.path.join(HERE, 'index.html') + '?render=1'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FPS = 30


def open_page(p):
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 1920, 'height': 1080})
    page.goto(URL)
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(300)
    return b, page


def total():
    with sync_playwright() as p:
        b, page = open_page(p)
        t = page.evaluate('TOTAL')
        b.close()
        return t


def chunk(args):
    idx, f0, f1 = args
    path = os.path.join(OUT, 'part%02d.mp4' % idx)
    enc = subprocess.Popen([FFMPEG, '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                            '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), path],
                           stdin=subprocess.PIPE)
    with sync_playwright() as p:
        b, page = open_page(p)
        for f in range(f0, f1):
            page.evaluate('t => seek(t)', f / FPS)
            enc.stdin.write(page.screenshot(type='jpeg', quality=94))
            if (f - f0) % 300 == 0:
                print('part %d: %d of %d' % (idx, f - f0, f1 - f0), flush=True)
        b.close()
    enc.stdin.close()
    enc.wait()
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--stills', nargs='*', type=float)
    ap.add_argument('--audio')
    ap.add_argument('--workers', type=int, default=4)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if a.stills:
        with sync_playwright() as p:
            b, page = open_page(p)
            for t in a.stills:
                page.evaluate('t => seek(t)', t)
                page.screenshot(path=os.path.join(OUT, 'still-%06.1f.png' % t))
            b.close()
        return
    frames = int(total() * FPS)
    n = a.workers
    step = -(-frames // n)
    jobs = [(i, i * step, min(frames, (i + 1) * step)) for i in range(n)]
    with ProcessPoolExecutor(n) as ex:
        parts = list(ex.map(chunk, jobs))
    lst = os.path.join(OUT, 'parts.txt')
    with open(lst, 'w') as f:
        f.writelines("file '%s'\n" % p for p in parts)
    silent = os.path.join(OUT, 'm360-demo.mp4')
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', silent], check=True)
    for p in parts:
        os.remove(p)
    os.remove(lst)
    print('wrote', silent, '(%d frames, %.1fs)' % (frames, frames / FPS))
    if a.audio:
        withvo = os.path.join(OUT, 'm360-demo-with-voiceover.mp4')
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', silent, '-i', a.audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                        '-shortest', '-movflags', '+faststart', withvo], check=True)
        print('wrote', withvo)


if __name__ == '__main__':
    sys.exit(main())
