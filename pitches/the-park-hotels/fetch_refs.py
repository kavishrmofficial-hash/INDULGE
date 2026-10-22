"""Fetches the references for The Park deck: python3 pitches/the-park-hotels/fetch_refs.py site|videos|motion <out-dir>

Runs in GitHub Actions (.github/workflows/park-refs.yml), because the coding sandbox cannot reach framer.website or
Google Drive.
  site    captures the Hanza Framer template (the design reference): full-page screenshots at desktop and phone width,
          each page's text and HTML, the computed type scale, the colours in use and the font files it loads.
  videos  downloads the shared Google Drive folder of video references, re-encodes each one small enough to publish
          with the deck (H.264, faststart, under 12 MB), and writes a poster, a frame strip and manifest.json.
  motion  records how the Hanza template moves: a video of the intro, one wheel tick, a burst, a slow scroll through the
          page and the hovers, a frame-by-frame log of scrollY (the smooth-scroll curve), contact sheets of frames after
          each event, and the animation settings found in the site's own scripts (js-grep.txt).
"""
import json, pathlib, re, shutil, subprocess, sys, traceback
from urllib.parse import urlparse, urldefrag

SITE = 'https://hanza-template.framer.website/'
FOLDER = 'https://drive.google.com/drive/folders/1mu2iXzDpEYf1CXChC1UYJkMxSIQBt8D_'
MAX_PAGES = 10
MAX_MB = 12

STYLES_JS = r"""() => {
  const seen = new Map();
  for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,button,li,div')) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    const key = [s.fontFamily, s.fontSize, s.fontWeight, s.letterSpacing, s.textTransform].join('|');
    const row = seen.get(key) || {fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight,
      lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, textTransform: s.textTransform, color: s.color,
      count: 0, samples: []};
    row.count++;
    if (row.samples.length < 4) row.samples.push(el.textContent.trim().slice(0, 90));
    seen.set(key, row);
  }
  const bg = new Map();
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    const c = getComputedStyle(el).backgroundColor;
    if (r.width * r.height < 20000 || c === 'rgba(0, 0, 0, 0)') continue;
    bg.set(c, (bg.get(c) || 0) + Math.round(r.width * r.height / 1000));
  }
  return {
    body: {background: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color},
    type: [...seen.values()].sort((a, b) => parseFloat(b.fontSize) - parseFloat(a.fontSize)),
    backgrounds: [...bg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
    fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight} ${f.style}`),
    height: document.documentElement.scrollHeight,
  };
}"""


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:60] or 'page'


def scroll_through(page):
    """Framer reveals sections as they scroll into view, so walk the page before the full-page screenshot."""
    y = 0
    while y < page.evaluate('document.documentElement.scrollHeight') and y < 40000:
        page.evaluate(f'window.scrollTo(0, {y})')
        page.wait_for_timeout(260)
        y += 500
    page.wait_for_timeout(800)
    page.evaluate('window.scrollTo(0, 0)')
    page.wait_for_timeout(1200)


def site(out):
    from playwright.sync_api import sync_playwright
    out.mkdir(parents=True, exist_ok=True)
    (out / 'fonts').mkdir(exist_ok=True)
    host = urlparse(SITE).netloc
    fonts, report = {}, {'pages': []}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        desk = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = desk.new_page()

        def keep_font(resp):
            u = resp.url
            if re.search(r'\.(woff2?|ttf|otf)(\?|$)', u) and u not in fonts:
                try:
                    body = resp.body()
                    name = slug(pathlib.Path(urlparse(u).path).stem) + pathlib.Path(urlparse(u).path).suffix
                    (out / 'fonts' / name).write_bytes(body)
                    fonts[u] = name
                except Exception as e:  # a font that cannot be read should not stop the capture
                    fonts[u] = f'failed: {e}'
        page.on('response', keep_font)

        page.goto(SITE, wait_until='networkidle', timeout=120000)
        links = [SITE]
        for href in page.eval_on_selector_all('a[href]', 'els => els.map(e => e.href)'):
            href = urldefrag(href)[0]
            if urlparse(href).netloc == host and href not in links:
                links.append(href)
        report['links'] = links
        for i, url in enumerate(links[:MAX_PAGES]):
            name = f'{i:02d}-{slug(urlparse(url).path) if urlparse(url).path.strip("/") else "home"}'
            try:
                page.goto(url, wait_until='networkidle', timeout=120000)
                scroll_through(page)
                page.screenshot(path=str(out / f'{name}.jpg'), full_page=True, type='jpeg', quality=72)
                (out / f'{name}.txt').write_text(page.evaluate('document.body.innerText'))
                (out / f'{name}.html').write_text(page.content())
                styles = page.evaluate(STYLES_JS)
                (out / f'{name}.styles.json').write_text(json.dumps(styles, indent=1))
                report['pages'].append({'url': url, 'file': name, 'height': styles['height']})
            except Exception as e:
                report['pages'].append({'url': url, 'file': name, 'error': repr(e)})
        dropped = links[MAX_PAGES:]
        if dropped:
            report['not_captured'] = dropped

        phone = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True,
                                    has_touch=True)
        mp = phone.new_page()
        for i, url in enumerate(links[:3]):
            try:
                mp.goto(url, wait_until='networkidle', timeout=120000)
                scroll_through(mp)
                mp.screenshot(path=str(out / f'phone-{i:02d}.jpg'), full_page=True, type='jpeg', quality=60)
            except Exception as e:
                report.setdefault('phone_errors', []).append(f'{url}: {e!r}')
        browser.close()
    report['fonts'] = fonts
    (out / 'report.json').write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))


def probe(f):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration',
                        '-of', 'json', str(f)], capture_output=True, text=True)
    j = json.loads(r.stdout or '{}')
    v = next((s for s in j.get('streams', []) if s.get('codec_type') == 'video'), {})
    a = any(s.get('codec_type') == 'audio' for s in j.get('streams', []))
    return {'width': v.get('width'), 'height': v.get('height'), 'fps': v.get('r_frame_rate'), 'audio': a,
            'duration': float(j.get('format', {}).get('duration') or 0)}


def videos(out):
    import gdown
    raw = pathlib.Path('raw-videos')
    raw.mkdir(exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    manifest = {'folder': FOLDER, 'files': []}
    try:
        try:
            got = gdown.download_folder(FOLDER, output=str(raw), quiet=False, use_cookies=False)
        except Exception:  # fall back to the command line, which some gdown versions handle differently
            manifest['api_error'] = traceback.format_exc()[-1500:]
            subprocess.run(['gdown', '--folder', FOLDER, '-O', str(raw)], check=False)
            got = [p for p in raw.rglob('*') if p.is_file()]
        manifest['downloaded'] = [str(g) for g in (got or [])]
        if not got:
            manifest['error'] = 'gdown returned nothing: the folder may not be shared as anyone with the link'
    except Exception:
        manifest['error'] = traceback.format_exc()[-2000:]
    for f in sorted(p for p in raw.rglob('*') if p.is_file()):
        row = {'source': str(f.relative_to(raw)), 'bytes': f.stat().st_size}
        name = slug(f.stem)
        info = probe(f)
        row.update(src=info)
        if not info['width'] or info['duration'] < 0.5:
            if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp'):
                shutil.copy(f, out / f'{name}{f.suffix.lower()}')
                row['image'] = f'{name}{f.suffix.lower()}'
            manifest['files'].append(row)
            continue
        w, h = info['width'], info['height']
        long_cap = 1280
        short_cap = 720
        if h >= w:
            tw = min(w, short_cap)
            th = round(h * tw / w)
            if th > long_cap:
                th, tw = long_cap, round(w * long_cap / h)
        else:
            tw = min(w, long_cap)
            th = round(h * tw / w)
        tw, th = tw - tw % 2, th - th % 2
        dst = out / f'{name}.mp4'
        for crf in (26, 29, 32, 35):
            cmd = ['ffmpeg', '-y', '-v', 'error', '-i', str(f), '-vf', f'scale={tw}:{th}', '-fpsmax', '30',
                   '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
                   '-movflags', '+faststart']
            cmd += ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] if info['audio'] else ['-an']
            subprocess.run(cmd + [str(dst)], check=True)
            if dst.stat().st_size <= MAX_MB * 1024 * 1024:
                break
        row.update(file=dst.name, out_bytes=dst.stat().st_size, crf=crf, size=[tw, th])
        dur = info['duration']
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{min(dur * 0.25, 3):.2f}', '-i', str(dst), '-frames:v', '1',
                        '-vf', 'scale=540:-2', '-q:v', '4', str(out / f'{name}.jpg')], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(dst), '-vf', f'fps={8 / dur:.4f},scale=200:-2,tile=8x1',
                        '-frames:v', '1', '-q:v', '5', str(out / f'{name}.strip.jpg')], check=False)
        row.update(poster=f'{name}.jpg', strip=f'{name}.strip.jpg')
        manifest['files'].append(row)
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=1))
    print(json.dumps(manifest, indent=1))


MOTION_PATTERNS = ['__framer__presenceAnimate', '__framer__presenceInitial', '__framer__animate', '__framer__enter', '__framer__exit',
                   '__framer__threshold', '__framer__styleTransformEffectEnabled', '__framer__transformTargets', '__framer__transformTrigger',
                   '__framer__spring', '__framer__loopEffectEnabled', '__framer__loop', '__framer__variantAppearEffectEnabled',
                   '__framer__targetOpacity', 'tokenization', 'whileHover', 'whileTap', 'new Lenis', 'lerp:', 'smoothWheel', 'wheelMultiplier',
                   'useScroll', 'scrollYProgress', 'perspective', '"Hover"', 'Hover:', 'backdropFilter', 'mask-image', 'Ticker', 'marquee']


def motion(out):
    import time
    from playwright.sync_api import sync_playwright
    out.mkdir(parents=True, exist_ok=True)
    (out / 'sheets').mkdir(exist_ok=True)
    js_dir = pathlib.Path('hanza-js'); js_dir.mkdir(exist_ok=True)
    marks, js = [], {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, record_video_dir='hanza-video',
                                  record_video_size={'width': 1440, 'height': 900})
        ctx.add_init_script("window.__log=[];(function f(){window.__log.push([Math.round(performance.now()),Math.round(scrollY)]);requestAnimationFrame(f)})();")
        page = ctx.new_page()
        t0 = time.monotonic()

        def keep_js(resp):
            u = resp.url
            if resp.request.resource_type == 'script' and u not in js:
                try:
                    body = resp.body()
                    name = re.sub(r'[^\w.-]+', '_', urlparse(u).path)[-90:] or 'script'
                    (js_dir / name).write_bytes(body)
                    js[u] = name
                except Exception as e:  # a script that cannot be read should not stop the capture
                    js[u] = f'failed: {e!r}'
        page.on('response', keep_js)

        def mark(name):
            marks.append({'name': name, 'video_s': round(time.monotonic() - t0, 3), 'perf_ms': page.evaluate('Math.round(performance.now())')})

        def hover(text, name):
            try:
                el = page.get_by_text(text, exact=False).first
                el.scroll_into_view_if_needed(timeout=5000)
                page.wait_for_timeout(1500)
                box = el.bounding_box()
                page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2, steps=4)
                mark(f'hover-{name}')
                page.wait_for_timeout(1200)
                page.mouse.move(5, 450, steps=4)
                mark(f'unhover-{name}')
                page.wait_for_timeout(1200)
            except Exception as e:
                marks.append({'name': f'hover-{name}-failed', 'error': repr(e)})

        page.goto(SITE, wait_until='domcontentloaded', timeout=120000)
        mark('load')
        page.wait_for_timeout(3500)
        page.mouse.move(720, 450)
        mark('wheel-one-tick')
        page.mouse.wheel(0, 100)
        page.wait_for_timeout(1800)
        mark('wheel-burst')
        for _ in range(10):
            page.mouse.wheel(0, 100)
            page.wait_for_timeout(16)
        page.wait_for_timeout(2200)
        mark('cruise')
        h = page.evaluate('document.documentElement.scrollHeight')
        n = 0
        while page.evaluate('scrollY') + 900 < h - 50 and n < 260:
            page.mouse.wheel(0, 90)
            page.wait_for_timeout(110)
            n += 1
        mark('cruise-end')
        page.wait_for_timeout(1500)
        page.keyboard.press('Home')
        page.wait_for_timeout(2500)
        mark('top')
        hover('Start Project', 'cta')
        hover('Menu', 'menu')
        try:
            page.get_by_text('Menu', exact=False).first.click()
            mark('menu-open')
            page.wait_for_timeout(1800)
            page.keyboard.press('Escape')
            page.mouse.click(1400, 60)
            mark('menu-close')
            page.wait_for_timeout(1500)
        except Exception as e:
            marks.append({'name': 'menu-failed', 'error': repr(e)})
        hover('View Project', 'view-project')
        hover('All Projects', 'all-projects')
        hover('Book a Call', 'book-call')
        hover('What Makes A Website', 'blog-card')
        hover('Strategy', 'accordion')
        log = page.evaluate('window.__log')
        video_path = page.video.path()
        ctx.close()
        browser.close()
    (out / 'scroll-log.json').write_text(json.dumps({'marks': marks, 'log': log}))
    (out / 'marks.json').write_text(json.dumps(marks, indent=1))
    # a small copy of the recording, and contact sheets of the frames after each event (10 fps, 1.6 s)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(video_path), '-vf', 'scale=960:-2', '-c:v', 'libx264', '-crf', '30',
                    '-preset', 'slow', '-pix_fmt', 'yuv420p', '-an', str(out / 'hanza-motion.mp4')], check=False)
    for m in marks:
        if 'video_s' not in m:
            continue
        span = 6 if m['name'] in ('cruise',) else 1.6
        cols = 8
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f"{max(0, m['video_s'] - 0.1):.2f}", '-t', f'{span}', '-i', str(video_path),
                        '-vf', f'fps={10 if span < 2 else 4},scale=360:-2,tile={cols}x2', '-frames:v', '1', '-q:v', '4',
                        str(out / 'sheets' / f"{m['name']}.jpg")], check=False)
    # the animation settings, read from the site's own scripts
    lines = [f'{len(js)} scripts', *[f'{v}  <-  {k}' for k, v in js.items()], '']
    blob = {f: (js_dir / f).read_text(errors='replace') for f in js.values() if (js_dir / f).exists()}
    for pat in MOTION_PATTERNS:
        hits = []
        for f, text in blob.items():
            for m_ in re.finditer(re.escape(pat), text):
                hits.append((f, text[max(0, m_.start() - 260):m_.end() + 420].replace('\n', ' ')))
        seen, uniq = set(), []
        for f, ctx_ in hits:
            key = re.sub(r'\w{6,}', '', ctx_)[:180]
            if key not in seen:
                seen.add(key)
                uniq.append((f, ctx_))
        lines.append(f'===== {pat}: {len(hits)} hits, {len(uniq)} distinct')
        for f, ctx_ in uniq[:14]:
            lines.append(f'--- {f}\n{ctx_}\n')
    (out / 'js-grep.txt').write_text('\n'.join(lines))
    print(json.dumps(marks, indent=1))


if __name__ == '__main__':
    {'site': site, 'videos': videos, 'motion': motion}[sys.argv[1]](pathlib.Path(sys.argv[2]))
