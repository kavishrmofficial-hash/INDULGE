/* GET /api/browse?u=... : reading mode, a public page rendered inside m360. */
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
  return app.browse(context.request);
}
