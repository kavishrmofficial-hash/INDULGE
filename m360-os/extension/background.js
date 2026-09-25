/* m360 frame helper. In tabs that show m360:
   1. answers to framed pages lose the headers that forbid framing (X-Frame-Options, frame-ancestors);
   2. a link a framed page tries to pop out into a new browser tab comes back into m360 instead;
   3. navigation inside the frame is reported, so m360's address bar follows.
   Nothing changes in any other tab. */
const M360 = /^https?:\/\/(m360os-[a-z0-9]+\.edgeone\.dev|[a-z0-9-]+\.edgeone\.dev|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)\//i;
const m360Tabs = new Set();
const allowOnce = new Map();   /* tabId -> until: the next popup from this tab may leave (m360 asked to open outside) */

const ruleFor = tabId => ({
  id: 100000 + (tabId % 100000), priority: 1,
  action: {type: 'modifyHeaders', responseHeaders: [
    {header: 'x-frame-options', operation: 'remove'},
    {header: 'content-security-policy', operation: 'remove'},
    {header: 'content-security-policy-report-only', operation: 'remove'}
  ]},
  condition: {resourceTypes: ['sub_frame'], tabIds: [tabId]}
});
async function refresh(tabId, url) {
  const on = M360.test(url || '');
  if (on) m360Tabs.add(tabId); else m360Tabs.delete(tabId);
  const id = 100000 + (tabId % 100000);
  try { await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: [id], addRules: on ? [ruleFor(tabId)] : []}); } catch (e) { /* a rule id in use elsewhere: leave it */ }
}
chrome.tabs.onUpdated.addListener((tabId, info, tab) => { if (info.url || info.status === 'loading') refresh(tabId, tab && tab.url); });
chrome.tabs.onRemoved.addListener(tabId => { m360Tabs.delete(tabId); chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: [100000 + (tabId % 100000)]}).catch(() => {}); });
const scan = async () => { const tabs = await chrome.tabs.query({}); tabs.forEach(t => refresh(t.id, t.url)); };
chrome.runtime.onInstalled.addListener(scan);
chrome.runtime.onStartup.addListener(scan);

/* 2. a popup from a framed page: close it, hand the address to m360 */
chrome.tabs.onCreated.addListener(async tab => {
  const opener = tab.openerTabId;
  if (opener == null || !m360Tabs.has(opener)) return;
  const until = allowOnce.get(opener) || 0;
  if (until > Date.now()) { allowOnce.delete(opener); return; }
  const url = tab.pendingUrl || tab.url || '';
  if (!/^https?:/i.test(url)) return;
  try { await chrome.tabs.remove(tab.id); } catch (e) { /* already gone */ }
  try { await chrome.tabs.sendMessage(opener, {m360ext: 'open', url}); } catch (e) { /* the page is not listening */ }
});

/* 3. the frame moved: tell m360 where it is now */
const report = d => {
  if (!d || d.frameId === 0 || !m360Tabs.has(d.tabId) || !/^https?:/i.test(d.url || '')) return;
  if (d.parentFrameId !== 0 && d.parentFrameId !== undefined && d.parentFrameId !== -1) return;   /* only the frame m360 owns, not frames inside it */
  chrome.tabs.sendMessage(d.tabId, {m360ext: 'nav', url: d.url}).catch(() => {});
};
if (chrome.webNavigation) {
  chrome.webNavigation.onCommitted.addListener(report);
  chrome.webNavigation.onHistoryStateUpdated.addListener(report);
}

/* m360 says the next popup may leave (Open outside) */
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.m360ext === 'allow-next' && sender.tab) allowOnce.set(sender.tab.id, Date.now() + 3000);
});
