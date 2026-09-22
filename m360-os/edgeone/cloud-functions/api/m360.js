/* The one m360 OS API: POST /api/m360 {a: action, ...}. Storage is the project's EdgeOne Pages Blob
   store, which the platform authenticates on its own inside Pages Functions. */
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
  return app(context.request);
}
