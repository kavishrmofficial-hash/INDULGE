/* The one m360 OS API: POST /api/m360 {a: action, ...}.
   Storage (v50): Supabase (store-supabase.js), with the EdgeOne Pages Blob store as the fallback while the site
   moves across; the Blob store alone when Supabase cannot be reached.
   v50.1: no setting to paste. The database and its publishable key are named below (a publishable key is
   public by design; the table's row policy is the lock). The lock's key is the server's own: a random name kept
   as an empty blob under ks/m360store~ (the full Blob store still takes an empty value), registered once with
   the database through m360_claim while its claim window is open, and checked by its SHA-256 from then on.
   Environment variables, when set, win: M360_STORE_URL, M360_STORE_ANON, M360_STORE_KEY. */
import {getStore} from '@edgeone/pages-blob';
import {createApp} from '../../server/core.js';
import {supabaseStore, hybridStore, ownKey} from '../../server/store-supabase.js';

const STORE_URL = 'https://fqhmszoclzfwzttvrwng.supabase.co';
const STORE_ANON = 'sb_publishable_8WT3XhPAsVSzzzoV4PiPAQ__0HGkBls';

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
    const url = env.M360_STORE_URL || STORE_URL, anon = env.M360_STORE_ANON || STORE_ANON;
    const key = env.M360_STORE_KEY || await ownKey(edge, {url, anon}).catch(() => '');
    if (key) store = hybridStore(supabaseStore({url, anon, key}), edge);
    app = createApp({store, env});
  }
  /* the move: a few seconds of copying per request, one at a time per instance, until it is done */
  if (store && store.migrate && !moving) {
    moving = true;
    try { const r = await store.migrate(3000); if (r && r.done) store.migrate = null; } catch (e) { /* the next request carries on */ } finally { moving = false; }
  }
  return app(context.request);
}
