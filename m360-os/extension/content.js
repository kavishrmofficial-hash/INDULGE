/* tells the m360 page the helper is here, and relays between the page and the helper */
document.documentElement.dataset.m360ext = '1';
chrome.runtime.onMessage.addListener(msg => { if (msg && msg.m360ext) window.postMessage(msg, '*'); });
window.addEventListener('message', e => {
  if (e.source !== window || !e.data || e.data.m360ext !== 'allow-next') return;
  try { chrome.runtime.sendMessage({m360ext: 'allow-next'}); } catch (x) { /* gone */ }
});
