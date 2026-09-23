/* Local stand-in for EdgeOne Pages: serves public/ and runs the same API function code against a
   file-backed blob store (etags are content MD5s, like the real store). Dev and tests only.
   node dev/server.mjs [port] [storeFile]   env MOCK_AI=1 answers AI calls locally. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server/core.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(here, '..', 'public');
const port = Number(process.argv[2] || 8788);
const file = process.argv[3] || path.join(here, '.store.json');

let data = {};
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = {}; }
const save = () => fs.writeFileSync(file, JSON.stringify(data));
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const store = {
  async get(key, opts) {
    if (!(key in data)) return null;
    return opts && opts.type === 'json' ? JSON.parse(data[key]) : data[key];
  },
  async set(key, value) { data[key] = String(value); save(); },
  async delete(key) { delete data[key]; save(); },
  async list(opts) {
    const p = (opts && opts.prefix) || '';
    return {blobs: Object.keys(data).filter(k => k.startsWith(p)).sort().map(k => ({key: k, etag: '&quot;' + md5(data[k]) + '&quot;'})), directories: []};
  }
};

/* a canned model: plain answers, JSON when asked, and one tool call when a tool fits */
globalThis.__mails = [];
async function fakeFetch(url, init) {
  const body = JSON.parse(init.body);
  if (String(url).includes('api.resend.com')) {
    if (!/^Bearer re_/.test(init.headers.authorization || '')) return new Response(JSON.stringify({message: 'bad key'}), {status: 401});
    globalThis.__mails.push({to: body.to, subject: body.subject, text: body.text});
    return new Response(JSON.stringify({id: 'm' + globalThis.__mails.length}), {status: 200, headers: {'content-type': 'application/json'}});
  }
  const last = body.messages[body.messages.length - 1];
  const text = typeof last.content === 'string' ? last.content : '';
  let content;
  if (Array.isArray(last.content)) content = [{type: 'text', text: 'Done. I took care of it.'}];
  else if (/Reply with JSON only/.test(text)) content = [{type: 'text', text: '{"summary":"All calm today.","items":[]}'}];
  else if (body.tools && body.tools.some(t => t.name === 'create_task') && /add a task/i.test(text))
    content = [{type: 'tool_use', id: 'tu1', name: 'create_task', input: {title: 'Cut the teaser', owner: 'me'}}];
  else content = [{type: 'text', text: 'Here is your day: finish the hero reel script first.'}];
  const stop = content.some(c => c.type === 'tool_use') ? 'tool_use' : 'end_turn';
  globalThis.__aiCalls = (globalThis.__aiCalls || 0) + 1;
  return new Response(JSON.stringify({content, stop_reason: stop}), {status: 200, headers: {'content-type': 'application/json'}});
}

const env = {...process.env};
if (process.env.MOCK_AI === '1') { env.ANTHROPIC_API_KEY = 'sk-ant-local-test-key-000000000000'; env.fetch = fakeFetch; }
const app = createApp({store, env});
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json'};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/m360') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, {method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined});
    const out = await app(request);
    const headers = {};
    out.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(out.status, headers);
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  if (url.pathname === '/__reset') { data = {}; save(); res.end('ok'); return; }
  if (url.pathname === '/__mails') { res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify(globalThis.__mails)); return; }
  if (url.pathname === '/__store') { res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify(data)); return; }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const f = path.join(PUB, path.normalize(rel));
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('m360 local edge on http://localhost:' + port));
