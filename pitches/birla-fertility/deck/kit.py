"""Small HTML helpers for the slides, in the Hanza look (deck.css). Every slide is a <section class="slide"> holding one 16:9
<div class="frame"> laid on four column guides."""
import re
from html import escape as esc

M_MARK = '<svg class="m" viewBox="0 0 1632 473" aria-hidden="true"><use href="#logo-m"/></svg>'

# Birla Fertility & IVF's logo (deck/client-logo.png, its name in white on navy from client-logo-rev.png), painted from the
# stylesheet by build.py, so the file travels once. AV is the three circles alone, the profile picture on the grid.
WORDMARK = '<span class="wm bf" role="img" aria-label="Birla Fertility &amp; IVF"></span>'
AV = '<i class="cmark" aria-hidden="true"></i>'
CHEV = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 L8 6 L4.5 9.5"/></svg>'
PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5l12 7.5-12 7.5z"/></svg>'


def btn(text, sub='', href='', cls=''):
    """Hanza's button: an ink block, mono words with a muted /suffix, a pink end with a chevron."""
    inner = f'<span>{text}{f" <em>/{sub}</em>" if sub else ""}</span><i>{CHEV}</i>'
    if href:
        return f'<a class="btn{" " + cls if cls else ""}" href="{href}">{inner}</a>'
    return f'<span class="btn{" " + cls if cls else ""}">{inner}</span>'


def lab(text, no='', cls=''):
    """The section label: a pink square, a mono number, the name."""
    return f'<p class="lab{" " + cls if cls else ""}">{f"<span class=mn>{no}</span>" if no else ""}<span>{text}</span></p>'


def dots(on, of=3):
    return '<span class="dots" aria-hidden="true">' + ''.join(f'<i{" class=on" if i < on else ""}></i>' for i in range(of)) + '</span>'


def hh(grey, ink, cls='h1', tag='h2'):
    """A two-tone heading: the grey line, then the ink line."""
    return f'<{tag} class="{cls}"><span class="g">{grey}</span> {ink}</{tag}>'


CHAPTERS = {'Your social today': ('01', 'Your social today'), 'The idea': ('02', 'No question too quiet'), 'How it runs': ('03', 'How it runs')}


def head(section):
    """The running head: Birla Fertility & IVF's logo left, the section label on the third guide, the Mask360 button right."""
    ch = section.split(' · ')[0]
    if ch in CHAPTERS:
        mid = f'<p class="lab"><span class="mn">{CHAPTERS[ch][0]}</span><span>{CHAPTERS[ch][1]}</span></p>'
    else:  # the slides outside the chapters carry their own label, so the head shows the date
        mid = '<p class="mono" style="grid-column:3"><span class="k">October</span>2026</p>'
    return (f'<div class="head">{WORDMARK}{mid}'
            f'<a class="btn" href="#next" aria-label="Mask360 proposal: next steps"><span>{M_MARK} <em>/Proposal</em></span><i>{CHEV}</i></a></div>')


def fab(kind, seed=1, cls='fab'):
    """A canvas the deck paints with procedurally drawn cloth (fabric.js) when it scrolls near."""
    return f'<canvas class="{cls}" data-fab="{kind}" data-seed="{seed}" aria-hidden="true"></canvas>'


def slide(sid, section, body, src='', dark=False, cls='', bare=False, cloth=None):
    """bare=True drops the running head (cover, close); cloth=(kind, seed) paints the whole slide with cloth. The dark pages
    carry a faint Mask360 watermark (.wmk in deck.css)."""
    if dark and not any(c in cls for c in ('cover', 'close')) and sid != 'mask360':
        cls = (cls + ' wmk').strip()
    hd = '' if bare else head(section)
    bg = fab(*cloth) if cloth else ''
    folio = f'<div class="folio"><span class="src">{src}</span><span class="pg" data-pg></span></div>'
    return (f'<section class="slide{" dark" if dark else ""}{" " + cls if cls else ""}" id="{sid}" tabindex="-1" aria-label="{esc(section)}">{bg}'
            f'<div class="frame">{hd}<div class="body">{body}</div>{folio}</div></section>')


def sep(n):
    return re.sub(r'([,~+])', r'<span class="sep">\1</span>', n)


def chapter(sid, no, title, line, cloth, inset, pages):
    """A chapter opener in the manner of Hanza's case-study rows: cloth full bleed, the meta row on the guides, an inset
    cloth card with a button to the first page, the title bottom right, the chapter's pages listed beside the line.
    title is (grey line, white line); pages is [(page number, name, slide id)]."""
    first = pages[0]
    lst = ''.join(f'<li><span class="mn">/{p}</span><a href="#{i}">{n}</a></li>' for p, n, i in pages)
    body = f'''<div class="chap grow">
  <p class="lab c1" style="grid-row:1"><span class="mn">{no}</span><span>Chapter</span></p>
  <p class="mono c3" style="grid-row:1"><span class="k">Chapter</span>{title[0]} {title[1]}</p>
  <p class="mono c4" style="grid-row:1;justify-self:end"><span class="k">Pages</span>{pages[0][0]} to {pages[-1][0]}</p>
  <div class="inset tile">{fab(*inset)}{btn("Begin", first[0], "#" + first[2])}</div>
  <div class="ttl"><h2 class="ct"><span class="g">{title[0]}</span> {title[1]}</h2></div>
  <p class="cl lede-s">{line}</p>
  <ul class="pages">{lst}</ul>
</div>'''
    return slide(sid, f'{no} · {title[0]} {title[1]}', body, dark=True, cls='chapter scrim', cloth=cloth, bare=True)


def stat(num, label, source='', idx='', on=1, of=3):
    """Hanza's stat card: a pink rule, a mono number and label with progress squares, the big number, the line."""
    return (f'<div class="card"><div class="card-h"><p class="lab" style="gap:.5em"><span class="mn">{idx}</span><span>{label}</span></p>'
            f'{dots(on, of)}</div><div class="big mt-m">{sep(num)}</div><p class="ink2">{source}</p></div>')


def ul(items, cls='list'):
    return f'<ul class="{cls}">' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'


def table(cols, rows, cls='tbl', right=(), total=None, col_cls=None):
    """cols: header labels; rows: lists of cell HTML; right: indexes of right-aligned columns; total: optional last row."""
    col_cls = col_cls or {}
    def cell(i, v, tag='td'):
        c = []
        dh = f' data-h="{esc(re.sub(r"<[^>]+>", "", cols[i]))}"' if tag == 'td' and i < len(cols) else ''
        if i in right:
            c.append('r')
        if i in col_cls:
            c.append(col_cls[i])
        return f'<{tag}{dh}{" class=" + chr(34) + " ".join(c) + chr(34) if c else ""}>{v}</{tag}>'
    h = '<tr>' + ''.join(cell(i, c, 'th') for i, c in enumerate(cols)) + '</tr>'
    b = ''.join('<tr>' + ''.join(cell(i, v) for i, v in enumerate(r)) + '</tr>' for r in rows)
    if total:
        b += '<tr class="tot">' + ''.join(cell(i, v) for i, v in enumerate(total)) + '</tr>'
    return f'<div class="scroll-x"><table class="{cls}"><thead>{h}</thead><tbody>{b}</tbody></table></div>'


def tile(kind, seed, no, title, dark_text=False, cls=''):
    """A cloth tile under grain, a mono number top left and an uppercase title bottom left."""
    return (f'<div class="tile{" d" if dark_text else ""}{" " + cls if cls else ""}">{fab(kind, seed)}'
            f'<div class="ov"><span class="no">{no}</span><span class="t">{title}</span></div></div>')


def video_card(v, no, source, caption, take, series):
    """A reference clip as a Hanza card: a mono row, the still with a play button and the running time, the series it feeds,
    the caption and what we take from it. v is a row from media/manifest.json. Nothing loads until play; play opens the
    clip over the deck."""
    w, h = v['size']
    secs = round(v['src']['duration'])
    name = esc(re.sub(r'<[^>]+>', '', f'Ref {no}, {source}. {caption}'))
    return (f'<figure class="vcard"><div class="pc-h"><span class="mono"><span class="k">Ref</span>{no}</span><span class="mono">{source}</span></div>'
            f'<div class="vbox" style="--ar:{w}/{h};--poster:url(media/{v["poster"]})">'
            f'<video preload="none" playsinline poster="media/{v["poster"]}" aria-label="{name}">'
            f'<source src="media/{v["file"]}" type="video/mp4"></video>'
            f'<button class="vplay" type="button" aria-label="Play: {name}"><span><b>Play</b><i>{PLAY}</i></span></button>'
            f'<span class="dur">{secs // 60}:{secs % 60:02d}</span></div>'
            f'<figcaption class="vb"><p class="lab">{series}</p><p class="cap">{caption}</p><p class="take">{take}</p></figcaption></figure>')
