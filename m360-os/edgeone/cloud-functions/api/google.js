/* Google's sign-in sends the browser back here: GET /api/google?code=...&state=... The core app turns
   the code into that person's tokens and sends them back into m360. */
import {getStore} from '@edgeone/pages-blob';
import {createApp} from '../../server/core.js';

let app = null;

export async function onRequest(context) {
  if (!app) {
    const blob = getStore({name: 'm360', consistency: 'strong'});
    const store = {
      get: (key, opts) => blob.get(key, opts),
      set: (key, value) => blob.set(key, value),
      delete: key => blob.delete(key),
      list: opts => blob.list(opts)
    };
    app = createApp({store, env: (context && context.env) || {}});
  }
  return app.google(context.request);
}
