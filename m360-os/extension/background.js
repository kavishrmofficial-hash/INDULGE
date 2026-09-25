/* m360 frame helper. For tabs that show m360, the answers to framed pages lose the headers that forbid
   framing (X-Frame-Options, frame-ancestors). Nothing changes in any other tab. */
const M360 = /^https?:\/\/(m360os-[a-z0-9]+\.edgeone\.dev|[a-z0-9-]+\.edgeone\.dev|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)\//i;
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
  const id = 100000 + (tabId % 100000);
  try {
    await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: [id], addRules: on ? [ruleFor(tabId)] : []});
  } catch (e) { /* a rule id in use elsewhere: leave it */ }
}
chrome.tabs.onUpdated.addListener((tabId, info, tab) => { if (info.url || info.status === 'loading') refresh(tabId, tab && tab.url); });
chrome.tabs.onRemoved.addListener(tabId => { chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: [100000 + (tabId % 100000)]}).catch(() => {}); });
chrome.runtime.onInstalled.addListener(async () => { const tabs = await chrome.tabs.query({}); tabs.forEach(t => refresh(t.id, t.url)); });
chrome.runtime.onStartup.addListener(async () => { const tabs = await chrome.tabs.query({}); tabs.forEach(t => refresh(t.id, t.url)); });
