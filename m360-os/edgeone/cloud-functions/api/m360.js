/* The one m360 OS API: POST /api/m360 {a: action, ...}.
   Storage (v50): Supabase (store-supabase.js) when the project's environment names it, M360_STORE_URL,
   M360_STORE_ANON and M360_STORE_KEY; the EdgeOne Pages Blob store otherwise. While the site moves across,
   the Blob store stays as the fallback for reads, and each request copies a little more over. */
import {getStore} from '@edgeone/pages-blob';
import {createApp} from '../../server/core.js';
import {supabaseStore, hybridStore} from '../../server/store-supabase.js';

let app = null, store = null, moving = false;

export async function onRequest(context) {
  const env = (context && context.env) || {};
  if (!app) {
    const blob = getStore({name: 'm360', consistency: 'strong'});
    const edge = {
      get: (key, opts) => blob.get(key, opts),
      /* opts.onlyIfNew: the create-only write the per-document lock uses (core.js withLock) */
      set: (key, value, opts) => (opts && opts.onlyIfNew ? blob.set(key, value, {onlyIfNew: true}) : blob.set(key, value)),
      delete: key => blob.delete(key),
      list: opts => blob.list(opts)
    };
    store = edge;
    if (env.M360_STORE_URL && env.M360_STORE_ANON && env.M360_STORE_KEY) {
      store = hybridStore(supabaseStore({url: env.M360_STORE_URL, anon: env.M360_STORE_ANON, key: env.M360_STORE_KEY}), edge);
    }
    app = createApp({store, env});
  }
  /* the move: a few seconds of copying per request, one at a time per instance, until it is done */
  if (store && store.migrate && !moving) {
    moving = true;
    try { const r = await store.migrate(3000); if (r && r.done) store.migrate = null; } catch (e) { /* the next request carries on */ } finally { moving = false; }
  }
  return app(context.request);
}
