/* Apollo posts phone numbers here after a reveal: POST /api/apollo. The core app keeps the ones a
   person on the team asked for in the last twenty minutes and drops the rest. */
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
  return app.apollo(context.request);
}
