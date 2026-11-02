"""Small HTML helpers for the slides. Every slide is a <section class="slide"> holding one 16:9 <div class="frame">."""
import re
from html import escape as esc

W_MARK = '<svg viewBox="0 0 1506 1194" aria-hidden="true"><use href="#logo-w"/></svg>'
M_MARK = '<svg class="m" viewBox="0 0 1632 473" aria-hidden="true"><use href="#logo-m"/></svg>'


WORDMARK = f'<span class="wm" aria-label="Westside">{W_MARK}<span class="t" aria-hidden="true">Westside</span></span>'


def head(section):
    return (f'<div class="head">{WORDMARK}'
            f'<span class="sec"><span class="label">{section}</span>{M_MARK}</span></div>')


def fab(kind, seed=1, cls='fab'):
    """A canvas the deck paints with procedurally drawn cloth (fabric.js) when it scrolls near."""
    return f'<canvas class="{cls}" data-fab="{kind}" data-seed="{seed}" aria-hidden="true"></canvas>'


def slide(sid, section, body, src='', dark=False, cls='', bare=False, cloth=None):
    """bare=True drops the running head (cover, close); cloth=(kind, seed) paints the whole slide with cloth."""
    hd = '' if bare else head(section)
    bg = fab(*cloth) if cloth else ''
    folio = f'<div class="folio"><span class="src">{src}</span><span class="pg label" data-pg></span></div>'
    return (f'<section class="slide{" dark" if dark else ""}{" " + cls if cls else ""}" id="{sid}" aria-label="{esc(section)}">{bg}'
            f'<div class="frame">{hd}<div class="body">{body}</div>{folio}</div></section>')


def sep(n):
    """Set the separators inside a Didone number in the sans (the Didone's are hairlines that vanish)."""
    return re.sub(r'([,–~+])', r'<span class="sep">\1</span>', n)


def photo(name, alt, pos='50% 50%'):
    """An image from media/ (beside the page), cropped to its box around pos."""
    return f'<img class="photo" src="media/{name}" alt="{esc(alt)}" loading="lazy" decoding="async" style="object-position:{pos}">'


def chapter(sid, no, title, line, cloth, light=False):
    """A chapter opener: cloth full bleed, a Didone chapter number, the chapter title and one line.
    light=True sets ink on a pale cloth (the appendix opener, which follows the dark close)."""
    body = (f'<div class="chap grow"><span class="cn">{no}</span><h2 class="ct">{title}</h2>'
            + (f'<p class="cl">{line}</p>' if line else '') + '</div>')
    return slide(sid, f'{no} · {title}', body, dark=not light, cls='chapter' + ('' if light else ' scrim'), bare=True, cloth=cloth)


def stat(num, label, source='', small=''):
    s = f'<div class="s">{source}</div>' if source else ''
    sm = f'<small>{small}</small>' if small else ''
    return f'<div class="stat"><div class="num"><span>{sep(num)}{sm}</span></div><div class="k">{label}</div>{s}</div>'


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


def months(items):
    """items: (month label like "Nov ’25", event html, result html, quiet?, (cloth kind, seed, light?))"""
    out = []
    for m, ev, rs, quiet, (kind, seed, light) in items:
        mon, _, yr = m.partition(' ')
        out.append(f'<div class="m{" quiet" if quiet else ""}"><div class="sw">{fab(kind, seed)}'
                   f'<span class="mn"{" style=color:var(--ink)" if light else ""}>{mon}<small>{yr}</small></span></div>'
                   f'<div class="ev">{ev}</div>' + (f'<div class="rs">{rs}</div>' if rs else '') + '</div>')
    return '<div class="months">' + ''.join(out) + '</div>'


def tile(kind, seed, no, title, dark_text=False, cls=''):
    """A cloth tile with a Didone number top left and a thin uppercase title bottom left."""
    return (f'<div class="tile{" d" if dark_text else ""}{" " + cls if cls else ""}">{fab(kind, seed)}'
            f'<div class="ov"><span class="no">{no}</span><span class="t">{title}</span></div></div>')


def video_card(v, caption, meta='', span=''):
    """v: manifest item or None (placeholder); span like '#t=4,35' plays only that part of the clip."""
    if not v:
        return (f'<figure class="vcard" style="margin:0"><div class="vbox"><div class="vempty">Video to come</div></div>'
                f'<figcaption class="cap">{caption}</figcaption></figure>')
    ar = f'{v["width"]}/{v["height"]}'
    slug = v['slug']
    return (f'<figure class="vcard" style="margin:0"><div class="vbox" style="--ar:{ar};--poster:url(media/{slug}.webp)">'
            f'<video preload="none" playsinline poster="media/{slug}.webp" aria-label="{esc(v.get("title", slug))}">'
            f'<source src="media/{slug}.av1.mp4{span}" type=\'video/mp4; codecs="av01.0.12M.08"\'>'
            f'<source src="media/{slug}.mp4{span}" type="video/mp4"></video>'
            f'<button class="vplay" type="button" aria-label="Play: {esc(v.get("title", slug))}"><span><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></span></button>'
            f'</div><figcaption class="cap">{caption}</figcaption>'
            + (f'<div class="meta">{meta}</div>' if meta else '') + '</figure>')
