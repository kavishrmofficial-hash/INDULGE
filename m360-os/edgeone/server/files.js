/* module: files. Attachments for chat: any file type, up to 25 MB, uploaded in parts and served back by
   GET /api/file?id=<id>. Parts sit at f/<id>~<n> as base64 text; the record at fm/<id>. A file uploaded
   into a direct message room is served only to the two people in it. */

const PART_MAX = 1024 * 1024;       /* base64 bytes per part */
const FILE_MAX = 25 * 1024 * 1024;  /* bytes */
const ID_OK = /^[a-z0-9]{12,40}$/;

const b64ToBytes = s => { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const safeName = n => String(n || 'file').replace(/[\r\n"\\]/g, '').slice(0, 160) || 'file';
const safeType = t => /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(String(t || '')) ? String(t) : 'application/octet-stream';

export function fileActions(h) {
  const {store, getJ, putJ, levelOf, LEVEL, HttpError, log, rand, listAll} = h;
  const raw = key => store.get(key, {type: 'text', consistency: 'strong'});
  const need = async v => { if (!v) throw new HttpError(401, 'noid'); if ((await levelOf(v.uid)) < LEVEL.interact) throw new HttpError(403, 'invalid_argument'); };
  const dmMembers = room => String(room || '').startsWith('dm.') ? String(room).slice(3).split('.') : null;
  const maySee = (v, meta) => { const pair = dmMembers(meta.room); return !pair || pair.indexOf(v.uid) >= 0; };

  const actions = {
    /* one part at a time; the last part closes the record. Returns {id, url, done} */
    async fileput(v, body) {
      await need(v);
      const total = Math.max(1, Math.min(64, Math.floor(Number(body.total) || 1)));
      const part = Math.floor(Number(body.part) || 0);
      if (part < 0 || part >= total) throw new HttpError(400, 'invalid_argument', 'bad part');
      const data = String(body.data || '');
      if (!/^[A-Za-z0-9+/=]*$/.test(data) || data.length > PART_MAX + 4) throw new HttpError(400, 'invalid_argument', 'bad part data');
      const size = Math.floor(Number(body.size) || 0);
      if (size <= 0 || size > FILE_MAX) throw new HttpError(400, 'invalid_argument', 'Files up to 25 MB.');
      let id = String(body.id || '');
      if (part === 0) { id = rand(24).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 24); }
      if (!ID_OK.test(id)) throw new HttpError(400, 'invalid_argument', 'bad id');
      if (part > 0) {
        const pending = await getJ('fp/' + id).catch(() => null);
        if (!pending || pending.by !== v.uid) throw new HttpError(400, 'invalid_argument', 'upload not started');
      }
      await store.set('f/' + id + '~' + part, data);
      const meta = {name: safeName(body.name), type: safeType(body.type), size, parts: total, by: v.uid, room: String(body.room || '').slice(0, 120), at: Date.now()};
      if (part === 0) await putJ('fp/' + id, {by: v.uid, at: Date.now(), total});
      const done = part === total - 1;
      if (done) {
        await putJ('fm/' + id, meta);
        await store.delete('fp/' + id).catch(() => {});
        await log(v.uid, 'file', '', meta.name + ' (' + Math.round(size / 1024) + ' KB)' + (meta.room ? ' in ' + meta.room : ''));
      }
      return {id, url: '/api/file?id=' + id, done, name: meta.name, type: meta.type, size};
    },
    async filemeta(v, body) {
      await need(v);
      const id = String(body.id || '');
      if (!ID_OK.test(id)) throw new HttpError(400, 'invalid_argument', 'bad id');
      const meta = await getJ('fm/' + id).catch(() => null);
      if (!meta || !maySee(v, meta)) throw new HttpError(404, 'invalid_argument', 'no such file');
      return {id, ...meta};
    },
    /* the uploader or an admin removes a file */
    async filedel(v, body) {
      await need(v);
      const id = String(body.id || '');
      if (!ID_OK.test(id)) throw new HttpError(400, 'invalid_argument', 'bad id');
      const meta = await getJ('fm/' + id).catch(() => null);
      if (!meta) return {ok: true};
      if (meta.by !== v.uid && (await levelOf(v.uid)) < LEVEL.admin) throw new HttpError(403, 'invalid_argument');
      for (const b of await listAll('f/' + id + '~')) await store.delete(b.key).catch(() => {});
      await store.delete('fm/' + id).catch(() => {});
      return {ok: true};
    }
  };

  /* GET /api/file?id=<id>[&dl=1]: the bytes, with the right type, for anyone allowed to see the room */
  async function fileGet(request, viewerOf) {
    let url;
    try { url = new URL(request.url); } catch (e) { return new Response('bad request', {status: 400}); }
    const id = url.searchParams.get('id') || '';
    if (!ID_OK.test(id)) return new Response('not found', {status: 404});
    const v = await viewerOf(request);
    if (!v) return new Response('sign in first', {status: 401});
    const meta = await getJ('fm/' + id).catch(() => null);
    if (!meta || !maySee(v, meta)) return new Response('not found', {status: 404});
    if ((await levelOf(v.uid)) < LEVEL.interact) return new Response('not found', {status: 404});
    const chunks = [];
    let total = 0;
    for (let i = 0; i < (meta.parts || 1); i++) {
      const s = await raw('f/' + id + '~' + i).catch(() => null);
      if (s == null) return new Response('gone', {status: 410});
      const bytes = b64ToBytes(String(s));
      chunks.push(bytes); total += bytes.length;
    }
    const body = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { body.set(c, at); at += c.length; }
    /* pictures, sound, video, pdf and plain text show in the browser; everything else, svg included, downloads */
    const inline = !url.searchParams.get('dl') && /^(image\/(?!svg)|video\/|audio\/|application\/pdf|text\/plain)/.test(meta.type);
    return new Response(body, {status: 200, headers: {
      'content-type': inline ? meta.type : 'application/octet-stream',
      'content-length': String(total),
      'content-disposition': (inline ? 'inline' : 'attachment') + '; filename="' + safeName(meta.name) + '"',
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src data:; media-src data: 'self'; style-src 'unsafe-inline'"
    }});
  }

  return {actions, fileGet};
}
