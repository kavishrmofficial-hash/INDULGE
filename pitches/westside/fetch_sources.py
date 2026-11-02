"""Fetches primary sources for the Westside proposal into research_notes/Westside proposal v4/sources/ as text.

Runs in GitHub Actions (the coding sandbox cannot reach the exchanges). Reads urls.txt in that folder:
  bse <scrip> <from YYYYMMDD> <to YYYYMMDD>   list the company's BSE announcements and fetch the ones that matter
  <url> <name>                                fetch one page or PDF
Writes <name>.txt for each document and bse_announcements.tsv for the listing."""
import json, pathlib, re, subprocess, sys, html, urllib.parse

OUT = pathlib.Path(sys.argv[1])
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
WANT = re.compile(r'update|investor|presentation|press release|annual report|financial results|analyst|transcript|westside|wesness', re.I)


def curl(url, dest, referer=''):
    cmd = ['curl', '-sSL', '--compressed', '-m', '120', '-A', UA, '-H', 'Accept-Language: en-US,en;q=0.9', '-o', str(dest), '-w', '%{http_code}']
    if referer:
        cmd += ['-H', f'Referer: {referer}', '-H', f'Origin: {referer.rstrip("/")}']
    r = subprocess.run(cmd + [url], capture_output=True, text=True)
    return r.stdout.strip()


def to_text(raw, name):
    head = raw.read_bytes()[:5]
    txt = OUT / f'{name}.txt'
    if head.startswith(b'%PDF'):
        subprocess.run(['pdftotext', '-layout', str(raw), str(txt)], check=False)
    else:
        s = raw.read_text(errors='ignore')
        s = re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>', ' ', s)
        s = re.sub(r'(?i)<br\s*/?>|</(p|div|li|h\d|tr)>', '\n', s)
        s = html.unescape(re.sub(r'<[^>]+>', ' ', s))
        s = re.sub(r'[ \t]+', ' ', s)
        txt.write_text(re.sub(r'\n\s*\n+', '\n\n', s))
    return txt


raw_dir = OUT / 'raw'
raw_dir.mkdir(parents=True, exist_ok=True)
for line in (OUT / 'urls.txt').read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#'):
        continue
    parts = line.split()
    if parts[0] == 'bse':
        scrip, d0, d1 = parts[1:4]
        rows = []
        for page in range(1, 11):
            api = ('https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?' + urllib.parse.urlencode(
                {'pageno': page, 'strCat': '-1', 'strPrevDate': d0, 'strScrip': scrip, 'strSearch': 'P', 'strToDate': d1, 'strType': 'C', 'subcategory': '-1'}))
            dest = raw_dir / f'bse_{page}.json'
            code = curl(api, dest, 'https://www.bseindia.com/')
            try:
                table = json.loads(dest.read_text()).get('Table', [])
            except Exception:
                print('bse page', page, code, dest.read_text()[:200]); break
            if not table:
                break
            rows += table
        lines = []
        for r in rows:
            att = r.get('ATTACHMENTNAME') or ''
            url = f'https://www.bseindia.com/xml-data/corpfiling/AttachLive/{att}' if att else ''
            subj = (r.get('NEWSSUB') or '') + ' | ' + (r.get('HEADLINE') or '')
            lines.append('\t'.join([str(r.get('NEWS_DT', ''))[:10], subj.replace('\t', ' '), url]))
            if att and WANT.search(subj):
                name = re.sub(r'[^a-z0-9]+', '_', (str(r.get('NEWS_DT', ''))[:10] + '_' + (r.get('NEWSSUB') or att)).lower())[:90]
                raw = raw_dir / f'{name}.pdf'
                code = curl(url, raw, 'https://www.bseindia.com/')
                print(code, name)
                if raw.exists() and raw.stat().st_size > 500:
                    to_text(raw, name)
        (OUT / 'bse_announcements.tsv').write_text('\n'.join(lines) + '\n')
        print(len(rows), 'BSE announcements')
    else:
        url, name = parts[0], parts[1]
        raw = raw_dir / name
        code = curl(url, raw, '')
        print(code, name, raw.stat().st_size if raw.exists() else 0)
        if raw.exists() and raw.stat().st_size > 200:
            to_text(raw, name)
