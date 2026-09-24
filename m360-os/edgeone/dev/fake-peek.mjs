/* dev only: canned company websites for the client brain. Return a Response, or null to fall through.
   One site: swissewellness.example with a homepage (title, meta description, a script and a style block
   that must never reach the text, an about link, body copy about collagen) and an about page. A second
   host, slow.example, never answers, so the timeout path can be tested. */

const page = body => new Response(body, {status: 200, headers: {'content-type': 'text/html; charset=utf-8'}});

const HOME = `<!doctype html><html><head><title>Swisse Wellness UAE &amp; Middle East</title>
<meta name="description" content="Premium collagen, vitamins and wellness supplements from Australia, now in the UAE.">
<style>.hero{display:none}</style>
<script>window.__tracker = 'SECRET_SCRIPT_TEXT';</script>
</head><body>
<nav><a href="/">Home</a> <a href="/about">About us</a> <a href="/shop">Shop</a> <a href="mailto:hello@swissewellness.example">Mail</a></nav>
<h1>Feel good every day</h1>
<p>Swisse makes marine collagen, multivitamins and beauty supplements for people who take their wellness seriously.</p>
<p>Available at pharmacies across Dubai and Abu Dhabi, and on our own store &ndash; free delivery over AED 150.</p>
<footer>&copy; Swisse Wellness UAE</footer>
</body></html>`;

const ABOUT = `<!doctype html><html><head><title>About Swisse</title></head><body>
<h1>About us</h1><p>Founded in Melbourne in 1969, Swisse is Australia's most trusted wellness brand. In the UAE we work with pharmacies, clinics and creators.</p>
<p>Our audience: women 25 to 45 who care about skin, sleep and energy.</p>
</body></html>`;

export async function fakePeek(url, init) {
  const u = String(url);
  if (/^https?:\/\/(www\.)?swissewellness\.example\/?$/.test(u)) return page(HOME);
  if (/^https?:\/\/(www\.)?swissewellness\.example\/about\/?$/.test(u)) return page(ABOUT);
  if (/^https?:\/\/(www\.)?slow\.example/.test(u)) {
    return new Promise((res, rej) => {
      const sig = init && init.signal;
      if (sig) sig.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); });
    });
  }
  return null;
}
