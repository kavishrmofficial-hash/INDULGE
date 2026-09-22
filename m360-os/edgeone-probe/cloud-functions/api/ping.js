import { getStore } from '@edgeone/pages-blob';

export async function onRequest(context) {
  const req = context.request;
  const out = {method: req.method, url: req.url, ctxKeys: Object.keys(context || {}),
    envKeys: Object.keys((context && context.env) || {}).filter(k => !/SECRET|TOKEN|KEY|CREDENTIAL/i.test(k)),
    cookieHeader: req.headers.get('cookie') || '', node: typeof process !== 'undefined' ? process.version : 'none'};
  try { out.body = await req.text(); } catch (e) { out.bodyError = String(e); }
  try {
    const store = getStore({name: 'probe', consistency: 'strong'});
    const prev = await store.get('count', {type: 'json'});
    const n = ((prev && prev.n) || 0) + 1;
    await store.setJSON('count', {n, at: Date.now()});
    const again = await store.get('count', {type: 'json'});
    let lockA = null, lockB = null;
    try { lockA = await store.set('lock-' + n, 'x', {onlyIfNew: true}); } catch (e) { lockA = 'err ' + e.message; }
    try { lockB = await store.set('lock-' + n, 'y', {onlyIfNew: true}); } catch (e) { lockB = 'err ' + e.message; }
    const listed = await store.list({prefix: 'lock-'});
    out.blob = {prev, wrote: n, readBack: again, lockA, lockB, lockVal: await store.get('lock-' + n), listed};
  } catch (e) {
    out.blobError = String(e && e.message || e);
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/models', {method: 'GET'});
    out.anthropicStatus = r.status;
  } catch (e) { out.anthropicError = String(e && e.message || e); }
  return new Response(JSON.stringify(out), {headers: {'content-type': 'application/json',
    'set-cookie': 'probe=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600'}});
}
