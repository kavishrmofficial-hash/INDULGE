/* the app every API function serves (v55): the store on Supabase (store-supabase.js), the EdgeOne Pages Blob store as
   the fallback while the site moves across, and the Blob store alone when Supabase cannot be reached.
   v50.1: no setting to paste. The database and its publishable key are named below (a publishable key is
   public by design; the table's row policy is the lock). The lock's key is the server's own: a random name kept
   as an empty blob under ks/m360store~ (the full Blob store still takes an empty value), registered once with
   the database through m360_claim while its claim window is open, and checked by its SHA-256 from then on.
   Environment variables, when set, win: M360_STORE_URL, M360_STORE_ANON, M360_STORE_KEY.
   v55: /api/file, /api/google, /api/browse and /api/mcp come up on the same store as /api/m360; before this the
   first three still read and wrote the old Blob store alone, which refuses every write since 9 November 2026. */
import {getStore} from '@edgeone/pages-blob';
import {createApp} from './core.js';
import {supabaseStore, hybridStore, ownKey} from './store-supabase.js';

/* v51: Singapore, next to EdgeOne's functions (Mumbai, the first home, was 60 to 70 ms a call away and made
   saves take 9 to 22 seconds). Mumbai stays as the read-through until everything written there is across */
const STORE_URL = 'https://xpjsympknbjcplwqrfdu.supabase.co';
const STORE_ANON = 'sb_publishable_zY79eW_3GUNfNy7qfyd-Fw_REbxuxSq';
const OLD_URL = 'https://fqhmszoclzfwzttvrwng.supabase.co';
const OLD_ANON = 'sb_publishable_8WT3XhPAsVSzzzoV4PiPAQ__0HGkBls';

/* v55.2: the site's public address, for what a function must name without a browser in front of it (the Claude
   connector's sign-in documents); env M360_PUBLIC_URL wins. build_edgeone.py's PUBLIC_URL is the same address */
const PUBLIC_URL = 'https://m360os-wx9u1bqs.edgeone.dev';

let app = null, store = null, triedAt = 0;

export async function appFor(env0) {
  const env = {M360_PUBLIC_URL: PUBLIC_URL, ...(env0 || {})};
  /* an instance that came up on the old store alone tries Supabase again every half minute */
  if (app && globalThis.__m360store && globalThis.__m360store.mode === 'edge' && Date.now() - triedAt > 30000) app = null;
  if (!app) {
    triedAt = Date.now();
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
    /* what happened is kept for the owner's storestatus (core.js) */
    const info = globalThis.__m360store = {mode: 'edge', at: Date.now(), error: null};
    let key = env.M360_STORE_KEY || '';
    if (!key) { try { key = await ownKey(edge, {url, anon, info}); } catch (e) { info.error = String((e && e.stack) || e).slice(0, 400); } }
    if (key) {
      /* v56: the old Mumbai project was paused on 2026-11-20 and its hostname stopped resolving, so
         every cache-missing read hung until the gateway timed out. The edge blob store is the only
         legacy source now; OLD_URL is kept for the record, not for traffic. */
      const old = edge;
      store = hybridStore(supabaseStore({url, anon, key}), old);
      info.mode = 'supabase';
    }
    app = createApp({store, env});
  }
  /* v50.4: the move runs from the owner's storemigrate action (core.js), in big parallel batches, never inside
     ordinary requests, which only read through the old store until it is done */
  globalThis.__m360migrate = store && store.migrate ? (ms => store.migrate(ms)) : null;
  return app;
}
