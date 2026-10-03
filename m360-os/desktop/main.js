/* m360 Desktop. One window shows the m360 site. The Web section asks this process for real Chromium
   views (WebContentsView), one per tab, laid over the page where the section draws its stage. Every
   site opens: nothing can refuse a real browser view, logins and cookies persist in their own session,
   and a link that wants a new window becomes a new m360 tab. */
'use strict';
const {app, BrowserWindow, WebContentsView, ipcMain, shell, session, Menu} = require('electron');
const path = require('path');

const SITE = process.env.M360_URL || 'https://m360os-wx9u1bqs.edgeone.dev/';
const PARTITION = 'persist:m360web';
let win = null;
let seq = 0;
const views = new Map();      /* id -> WebContentsView */
let bounds = {x: 0, y: 0, width: 0, height: 0};
let active = null;
let shown = false;

const send = (channel, payload) => { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); };
const state = (id, v, extra) => ({id, url: v.webContents.getURL(), title: v.webContents.getTitle(), loading: v.webContents.isLoading(),
  canBack: v.webContents.navigationHistory ? v.webContents.navigationHistory.canGoBack() : v.webContents.canGoBack(),
  canFwd: v.webContents.navigationHistory ? v.webContents.navigationHistory.canGoForward() : v.webContents.canGoForward(), ...(extra || {})});

function place(id) {
  for (const [vid, v] of views) v.setVisible(shown && vid === id);
  const v = views.get(id);
  if (v) v.setBounds(bounds);
}

function makeView(url) {
  const id = ++seq;
  const v = new WebContentsView({webPreferences: {partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false}});
  views.set(id, v);
  win.contentView.addChildView(v);
  v.setBounds(bounds);
  v.setVisible(false);
  const wc = v.webContents;
  const tell = extra => send('web:update', state(id, v, extra));
  wc.on('did-navigate', () => tell());
  wc.on('did-navigate-in-page', () => tell());
  wc.on('page-title-updated', () => tell());
  wc.on('page-favicon-updated', (e, icons) => tell({favicon: icons && icons[0] ? icons[0] : ''}));
  wc.on('did-start-loading', () => tell());
  wc.on('did-stop-loading', () => tell());
  wc.on('did-fail-load', (e, code, desc, failedUrl, isMain) => { if (isMain && code !== -3) tell({error: desc}); });
  /* a new window from a page becomes another tab in m360 */
  wc.setWindowOpenHandler(({url: u}) => { if (/^https?:/i.test(u)) { const nid = makeView(u); send('web:new', {id: nid, url: u}); } return {action: 'deny'}; });
  wc.on('destroyed', () => { views.delete(id); });
  if (url) wc.loadURL(url).catch(() => {});
  return id;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, title: 'm360',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#F7F5F0',
    webPreferences: {preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false}
  });
  win.loadURL(SITE);
  /* links the m360 page itself opens in a new window become tabs too, except the site's own address */
  win.webContents.setWindowOpenHandler(({url: u}) => { if (/^https?:/i.test(u) && !u.startsWith(SITE)) { const id = makeView(u); send('web:new', {id, url: u}); } return {action: 'deny'}; });
  win.on('closed', () => { win = null; views.clear(); });
  win.on('resize', () => { if (active != null) place(active); });
}

ipcMain.handle('web:open', (e, url) => makeView(String(url || '')));
ipcMain.handle('web:activate', (e, id) => { active = Number(id); shown = true; place(active); });
ipcMain.handle('web:hide', () => { shown = false; for (const [, v] of views) v.setVisible(false); });
ipcMain.handle('web:close', (e, id) => { const v = views.get(Number(id)); if (!v) return; try { win.contentView.removeChildView(v); v.webContents.close(); } catch (x) { /* gone */ } views.delete(Number(id)); if (active === Number(id)) active = null; });
ipcMain.handle('web:navigate', (e, {id, url}) => { const v = views.get(Number(id)); if (v && /^https?:/i.test(String(url))) v.webContents.loadURL(String(url)).catch(() => {}); });
const history = v => v.webContents.navigationHistory || v.webContents;
ipcMain.handle('web:back', (e, id) => { const v = views.get(Number(id)); if (v && history(v).canGoBack()) history(v).goBack(); });
ipcMain.handle('web:forward', (e, id) => { const v = views.get(Number(id)); if (v && history(v).canGoForward()) history(v).goForward(); });
ipcMain.handle('web:reload', (e, id) => { const v = views.get(Number(id)); if (v) v.webContents.reload(); });
ipcMain.handle('web:bounds', (e, b) => { bounds = {x: Math.max(0, Number(b.x) || 0), y: Math.max(0, Number(b.y) || 0), width: Math.max(0, Number(b.width) || 0), height: Math.max(0, Number(b.height) || 0)}; if (active != null) place(active); });
ipcMain.handle('web:outside', (e, url) => { if (/^https?:/i.test(String(url))) shell.openExternal(String(url)); });

/* ---------- notices: m360's own card over every other window ----------
   While the m360 window is in the background, the page hands its notices here (window.m360desktop.notify)
   and each becomes a small borderless window in the top right of the screen the pointer is on, drawn by
   notice.html in the house look. It never takes focus; a tap brings m360 forward on the thing it was about,
   the cross or its time sends it away, a hovering pointer holds it. At most four stack; the same key twice
   is one card. */
const NOTE_W = 384, NOTE_H = 112, NOTE_GAP = 2, NOTE_MAX = 4;
const notes = [];   /* {key, win, href, timer, left, until} */
function noteBounds(i) {
  const {screen} = require('electron');
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  return {x: Math.round(wa.x + wa.width - NOTE_W - 6), y: Math.round(wa.y + 6 + i * (NOTE_H + NOTE_GAP)), width: NOTE_W, height: NOTE_H};
}
function restack() { notes.forEach((n, i) => { if (!n.win.isDestroyed()) n.win.setBounds(noteBounds(i), process.platform === 'darwin'); }); }
function dropNote(n) {
  const i = notes.indexOf(n);
  if (i >= 0) notes.splice(i, 1);
  clearTimeout(n.timer);
  if (!n.win.isDestroyed()) n.win.destroy();
  restack();
}
function leaveNote(n) {
  /* the card slides itself out, then asks to go; a card that never answers goes anyway */
  clearTimeout(n.timer);
  if (n.win.isDestroyed()) return dropNote(n);
  n.win.webContents.send('note:out');
  n.timer = setTimeout(() => dropNote(n), 450);
}
function arm(n, ms) { clearTimeout(n.timer); n.until = Date.now() + ms; n.timer = setTimeout(() => leaveNote(n), ms); }
function showNote(p) {
  const key = String((p && p.key) || '');
  const title = String((p && p.title) || 'm360').slice(0, 80);
  const body = String((p && p.body) || '').slice(0, 200);
  const life = Math.max(3000, Math.min(60000, Number(p && p.life) || 6500));
  const href = String((p && p.href) || '');
  if (key && notes.some(n => n.key === key)) return;
  while (notes.length >= NOTE_MAX) dropNote(notes[0]);
  const w = new BrowserWindow({...noteBounds(notes.length), frame: false, transparent: true, resizable: false, movable: false, minimizable: false,
    maximizable: false, fullscreenable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false, acceptFirstMouse: true,
    backgroundColor: '#00000000', webPreferences: {preload: path.join(__dirname, 'notice-preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false}});
  w.setAlwaysOnTop(true, 'screen-saver');
  try { w.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true}); } catch (x) { /* not on this platform */ }
  const n = {key, win: w, href, timer: null, until: 0};
  notes.push(n);
  w.loadFile(path.join(__dirname, 'notice.html'), {query: {title, body, life: String(life)}}).catch(() => dropNote(n));
  w.once('ready-to-show', () => { if (!w.isDestroyed()) w.showInactive(); });
  w.on('closed', () => { const i = notes.indexOf(n); if (i >= 0) { notes.splice(i, 1); clearTimeout(n.timer); restack(); } });
  arm(n, life);
}
const noteOf = e => notes.find(n => !n.win.isDestroyed() && n.win.webContents.id === e.sender.id);
ipcMain.handle('notice:show', (e, p) => { if (win && !win.isDestroyed() && e.sender.id === win.webContents.id) showNote(p); });
ipcMain.on('note:click', e => {
  const n = noteOf(e);
  if (!n) return;
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show(); win.focus();
    if (process.platform === 'darwin') app.focus({steal: true});
    if (n.href) send('notice:open', {href: n.href});
  }
  dropNote(n);
});
ipcMain.on('note:close', e => { const n = noteOf(e); if (n) leaveNote(n); });
ipcMain.on('note:done', e => { const n = noteOf(e); if (n) dropNote(n); });
ipcMain.on('note:hover', (e, on) => {
  const n = noteOf(e);
  if (!n) return;
  if (on) { clearTimeout(n.timer); n.left = Math.max(1500, n.until - Date.now()); } else arm(n, Math.max(2500, n.left || 2500));
});

app.whenReady().then(() => {
  /* a plain, browser-like user agent for the framed sites, so nobody serves an embedded-view page */
  const ses = session.fromPartition(PARTITION);
  ses.setUserAgent(ses.getUserAgent().replace(/ m360\/[\d.]+/, '').replace(/ Electron\/[\d.]+/, ''));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label: 'm360', submenu: [{role: 'about'}, {type: 'separator'}, {role: 'quit'}]},
    {label: 'Edit', submenu: [{role: 'undo'}, {role: 'redo'}, {type: 'separator'}, {role: 'cut'}, {role: 'copy'}, {role: 'paste'}, {role: 'selectAll'}]},
    {label: 'View', submenu: [{role: 'reload'}, {role: 'togglefullscreen'}, {type: 'separator'}, {role: 'resetZoom'}, {role: 'zoomIn'}, {role: 'zoomOut'}]},
    {label: 'Window', submenu: [{role: 'minimize'}, {role: 'close'}]}
  ]));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
