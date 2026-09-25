/* the bridge the m360 page sees as window.m360desktop */
const {contextBridge, ipcRenderer} = require('electron');
const on = (channel, cb) => { const f = (e, p) => cb(p); ipcRenderer.on(channel, f); return () => ipcRenderer.removeListener(channel, f); };
contextBridge.exposeInMainWorld('m360desktop', {
  version: 1,
  open: url => ipcRenderer.invoke('web:open', String(url || '')),
  activate: id => ipcRenderer.invoke('web:activate', id),
  hide: () => ipcRenderer.invoke('web:hide'),
  close: id => ipcRenderer.invoke('web:close', id),
  navigate: (id, url) => ipcRenderer.invoke('web:navigate', {id, url: String(url || '')}),
  back: id => ipcRenderer.invoke('web:back', id),
  forward: id => ipcRenderer.invoke('web:forward', id),
  reload: id => ipcRenderer.invoke('web:reload', id),
  setBounds: b => ipcRenderer.invoke('web:bounds', b || {}),
  outside: url => ipcRenderer.invoke('web:outside', String(url || '')),
  onUpdate: cb => on('web:update', cb),
  onNew: cb => on('web:new', cb)
});
