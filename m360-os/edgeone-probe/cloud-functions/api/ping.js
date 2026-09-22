import { getStore } from '@edgeone/pages-blob';

export async function onRequest(context) {
  const out = {method: context.request.method, keys: Object.keys(context || {}), envKeys: Object.keys((context && context.env) || {}).filter(k => !/SECRET|TOKEN|KEY|CREDENTIAL/i.test(k))};
  try {
    const store = getStore({name: 'probe', consistency: 'strong'});
    const prev = await store.get('count', {type: 'json'});
    const n = ((prev && prev.n) || 0) + 1;
    await store.setJSON('count', {n, at: Date.now()});
    const again = await store.get('count', {type: 'json'});
    out.blob = {prev, wrote: n, readBack: again};
  } catch (e) {
    out.blobError = String(e && e.message || e);
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/models', {method: 'GET'});
    out.anthropicStatus = r.status;
  } catch (e) { out.anthropicError = String(e && e.message || e); }
  return new Response(JSON.stringify(out), {headers: {'content-type': 'application/json'}});
}
