/* module: profile. Your profile on Me: a photo, pronouns, city, phone, a line about you, what to ask
   you about, links, birthday and a fun fact. Everything lives in me/<uid> (the person's own document)
   and shows on the Person page and the crew list. Photos are shrunk in the browser to a 160 px JPEG;
   02-state rebuilds M.photos from me/*.photo so every avatar picks it up. */
'use strict';
(function () {
  const {html, React, UI, icons} = M;
  const {useState, useEffect, useRef} = React;

  const LIMITS = {pronouns: 20, city: 40, phone: 20, bio: 240, askMe: 80, fact: 120, link: 120};
  const FIELDS = ['pronouns', 'city', 'phone', 'bio', 'askMe', 'instagram', 'linkedin', 'portfolio', 'birthday', 'fact'];
  const LINKS = [
    {k: 'instagram', label: 'instagram', placeholder: '@handle or a link'},
    {k: 'linkedin', label: 'linkedin', placeholder: 'handle or a link'},
    {k: 'portfolio', label: 'portfolio', placeholder: 'yoursite.in'}
  ];
  const PHOTO_PX = 160;
  const PHOTO_MAX = 40 * 1024;

  /* ---------- pure helpers ---------- */
  const isUrl = v => /^https?:\/\//i.test(v);
  /* a portfolio is always a site. instagram and linkedin take a handle unless the text has a path in it. */
  const isSite = (kind, v) => isUrl(v) || (v[0] !== '@' && (kind === 'portfolio' || v.includes('/')));
  /* a stored link is a web address or a handle. null means it will not do. */
  function cleanLink(v) {
    v = String(v || '').trim().slice(0, LIMITS.link);
    if (!v) return '';
    if (/\s/.test(v)) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !isUrl(v)) return null;
    if (!/^[\w@.~:/?#&()*+,;=%-]+$/.test(v)) return null;
    return v;
  }
  function linkHref(kind, v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (isUrl(v)) return v;
    if (isSite(kind, v)) return 'https://' + v;
    const h = encodeURIComponent(v.replace(/^@/, ''));
    if (kind === 'instagram') return 'https://instagram.com/' + h;
    if (kind === 'linkedin') return 'https://linkedin.com/in/' + h;
    return 'https://' + h;
  }
  function linkText(kind, v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (!isSite(kind, v)) return '@' + v.replace(/^@/, '');
    const host = v.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0];
    return (host || kind).slice(0, 32);
  }
  function cleanPhone(v) {
    v = String(v || '').trim().slice(0, LIMITS.phone);
    if (!v) return '';
    if (!/^\+?[\d\s()-]{5,20}$/.test(v)) return null;
    return v;
  }
  const telHref = v => 'tel:' + String(v || '').replace(/[^\d+]/g, '');
  const mmdd = s => /^\d{2}-\d{2}$/.test(String(s || '')) ? s : '';
  /* the profile fields of one person, every value a string */
  function of(ctx, uid) {
    const me = (ctx && ctx.coll && ctx.coll.me && ctx.coll.me.map[uid]) || {};
    const out = {};
    FIELDS.forEach(k => { out[k] = String(me[k] || '').trim(); });
    out.birthday = mmdd(out.birthday);
    return out;
  }

  /* ---------- the photo: cover crop to a square, 160 px, JPEG ---------- */
  function load(file) {
    return new Promise((res, rej) => {
      let url = '';
      try { url = URL.createObjectURL(file); } catch (e) { rej(new Error('decode')); return; }
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }
  function shrink(file) {
    return load(file).then(img => {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (!w || !h) throw new Error('decode');
      const c = document.createElement('canvas');
      c.width = PHOTO_PX; c.height = PHOTO_PX;
      const g = c.getContext('2d');
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, PHOTO_PX, PHOTO_PX);
      const s = Math.min(w, h);
      g.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, PHOTO_PX, PHOTO_PX);
      let out = c.toDataURL('image/jpeg', 0.82);
      if (out.length > PHOTO_MAX) out = c.toDataURL('image/jpeg', 0.7);
      if (out.length > PHOTO_MAX) throw new Error('big');
      return out;
    });
  }

  /* ---------- the card on Me ---------- */
  function ProfileCard() {
    const ctx = M.useCtx();
    const uid = ctx.uid;
    const saved = of(ctx, uid);
    const savedKey = JSON.stringify(saved);
    const fromSaved = () => ({...saved, birthday: saved.birthday ? '2000-' + saved.birthday : ''});
    const [d, setD] = useState(fromSaved);
    const [photo, setPhoto] = useState(undefined);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    const profs = M.useProfiles([uid]);
    const prof = profs[uid] || {};
    /* the form follows the saved document until the person types */
    useEffect(() => { setD(fromSaved()); setPhoto(undefined); }, [savedKey]);

    const upd = patch => setD(x => ({...x, ...patch}));
    const field = (k, v) => upd({[k]: String(v || '').slice(0, LIMITS[k] || LIMITS.link)});
    const draftKey = JSON.stringify({...d, birthday: d.birthday ? d.birthday.slice(5) : ''});
    const stored = (M.photos && M.photos[uid]) || '';
    const changed = draftKey !== savedKey || (photo !== undefined && photo !== stored);
    const shown = photo !== undefined ? (photo || prof.avatarUrl || M.AV_FALLBACK) : (stored || prof.avatarUrl || M.AV_FALLBACK);
    const hasPhoto = photo !== undefined ? !!photo : !!stored;

    const onFile = e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type || '')) { M.toast('Pick an image file.', true); return; }
      shrink(f).then(setPhoto, err => M.toast(err && err.message === 'big'
        ? 'That photo stays too big even when shrunk. Try a simpler picture.'
        : 'That picture did not open. Try another one.', true));
    };
    const save = () => {
      if (!changed || busy) return;
      const patch = {};
      for (const l of LINKS) {
        const v = cleanLink(d[l.k]);
        if (v === null) { M.toast('Check the ' + l.label + ' link. A web address or a handle works.', true); return; }
        patch[l.k] = v;
      }
      const phone = cleanPhone(d.phone);
      if (phone === null) { M.toast('Check the phone number. Digits, spaces and a plus sign work.', true); return; }
      patch.phone = phone;
      for (const k of ['pronouns', 'city', 'bio', 'askMe', 'fact']) patch[k] = String(d[k] || '').trim().slice(0, LIMITS[k]);
      patch.birthday = d.birthday ? d.birthday.slice(5) : '';
      if (photo !== undefined) patch.photo = photo;
      setBusy(true);
      ctx.W.merge('me/' + uid, patch)
        .then(() => M.toast('Saved'))
        .catch(() => {})
        .then(() => setBusy(false));
    };

    const m = ctx.member || {};
    const title = [m.title, m.pod].filter(Boolean).join(', ');
    const meta = [d.pronouns.trim(), d.city.trim()].filter(Boolean).join(' · ');
    /* the form body keeps the v4 about-card id (birthday and the fun fact used to live on their own card) */
    return html`<${UI.Card} id="profile-card" title="Your profile">
      <div class="stack" id="about-card">
        <div class="prof-preview">
          <img class="av" src=${shown} alt=${prof.name || 'you'} width="64" height="64" style=${{width: '64px', height: '64px'}}/>
          <div class="grow">
            <div class="nm"><${UI.Name} id=${uid} fallback="You"/></div>
            ${title ? html`<div class="ti">${title}</div>` : null}
            ${meta ? html`<div class="ti">${meta}</div>` : null}
          </div>
        </div>
        <${UI.Field} label="photo" hint="Square works best. It is shrunk to 160 px and shows everywhere your name does.">
          <div class="row">
            <input type="file" accept="image/*" id="profile-photo" class="prof-file" ref=${fileRef} onChange=${onFile} aria-label="Choose a photo"/>
            <${UI.Btn} kind="sec" sm=${true} onClick=${() => fileRef.current && fileRef.current.click()}>Choose a photo<//>
            ${hasPhoto ? html`<${UI.Btn} kind="ghost" sm=${true} onClick=${() => setPhoto('')}>Remove photo<//>` : null}
          </div>
        <//>
        <${NameField} uid=${uid} name=${prof.name || ''}/>
        <div class="grid2">
          <${UI.Input} id="profile-pronouns" label="pronouns" value=${d.pronouns} onChange=${v => field('pronouns', v)} placeholder="she/her"/>
          <${UI.Input} id="profile-city" label="city" value=${d.city} onChange=${v => field('city', v)} placeholder="Mumbai"/>
        </div>
        <${UI.TextArea} id="profile-bio" label="about you" rows=${3} value=${d.bio} onChange=${v => field('bio', v)}
          placeholder="Two lines on what you do and what you love." hint=${d.bio.length + ' of ' + LIMITS.bio}/>
        <div class="grid2">
          <${UI.Input} id="profile-askme" label="ask me about" value=${d.askMe} onChange=${v => field('askMe', v)} placeholder="Reels, typography, Goa"/>
          <${UI.Input} id="profile-phone" label="phone" type="tel" value=${d.phone} onChange=${v => field('phone', v)} placeholder="+91 98200 00000" hint="Optional. The team can see it."/>
        </div>
        <div class="grid3">
          ${LINKS.map(l => html`<${UI.Input} key=${l.k} id=${'profile-' + l.k} label=${l.label} value=${d[l.k]} onChange=${v => field(l.k, v)} placeholder=${l.placeholder}/>`)}
        </div>
        <div class="grid2">
          <${UI.Input} id="profile-birthday" label="birthday" type="date" value=${d.birthday} onChange=${v => upd({birthday: v})}
            hint="Only the day and month are kept. The team gets a nudge to wish you."/>
          <${UI.Input} id="profile-fact" label="one fun fact" value=${d.fact} onChange=${v => field('fact', v)} placeholder="Makes a mean filter coffee"/>
        </div>
        <div class="row"><${UI.Btn} id="profile-save" disabled=${!changed || busy} onClick=${save}>Save profile<//></div>
      </div>
    <//>`;
  }

  /* the display name: editable on the standalone build, from the Claude account otherwise */
  function NameField({uid, name}) {
    const [draft, setDraft] = useState(name);
    const [busy, setBusy] = useState(false);
    useEffect(() => { setDraft(name); }, [name]);
    if (!window.M360_STANDALONE || typeof window.M360_API !== 'function') {
      return html`<div class="hint">Your name comes from your Claude account.</div>`;
    }
    const v = String(draft || '').trim().slice(0, 60);
    const save = () => {
      if (!v || v === name || busy) return;
      setBusy(true);
      window.M360_API('rename', {name: v})
        .then(() => M.toast('Saved. It shows after the next refresh.'), () => M.toast('That did not save. Try again in a moment.', true))
        .then(() => setBusy(false));
    };
    return html`<${UI.Field} label="name">
      <div class="row nowrap">
        <input id="profile-name" class="input grow" value=${draft} onInput=${e => setDraft(e.target.value.slice(0, 60))} aria-label="Your name"
          onKeyDown=${e => { if (e.key === 'Enter') save(); }}/>
        <${UI.Btn} sm=${true} disabled=${!v || v === name || busy} onClick=${save}>Save name<//>
      </div>
    <//>`;
  }

  /* ---------- what teammates see: the details block on the Person page ---------- */
  function Details({uid}) {
    const ctx = M.useCtx();
    const p = of(ctx, uid);
    const links = LINKS.filter(l => p[l.k]);
    const facts = [['ask me about', p.askMe], ['fun fact', p.fact]].filter(x => x[1]);
    if (!p.bio && !links.length && !facts.length && !p.phone) return null;
    return html`<div class="stack tight prof-details" id="person-details">
      ${p.bio ? html`<p class="prof-bio">${p.bio}</p>` : null}
      ${facts.length || p.phone ? html`<div class="prof-facts">
        ${facts.map(([k, v]) => html`<div key=${k}><span class="k">${k}</span>${v}</div>`)}
        ${p.phone ? html`<div><span class="k">phone</span><a class="prof-tel num" href=${telHref(p.phone)}>${p.phone}</a></div>` : null}
      </div>` : null}
      ${links.length ? html`<div class="prof-links">
        ${links.map(l => html`<a key=${l.k} class="pill prof-link" href=${linkHref(l.k, p[l.k])} target="_blank" rel="noopener noreferrer">
          <${icons.link}/><span class="k">${l.label}</span>${linkText(l.k, p[l.k])}</a>`)}
      </div>` : null}
    </div>`;
  }

  M.parts.ProfileCard = ProfileCard;
  M.parts.ProfileDetails = Details;
  M.profile = {FIELDS, LIMITS, LINKS, of, cleanLink, cleanPhone, linkHref, linkText, telHref, shrink};
})();
