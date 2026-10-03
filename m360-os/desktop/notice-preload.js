/* the bridge a desktop notice card sees as window.m360note: a tap, a dismiss, a hover that holds it */
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('m360note', {
  click: () => ipcRenderer.send('note:click'),
  close: () => ipcRenderer.send('note:close'),
  hover: on => ipcRenderer.send('note:hover', !!on),
  done: () => ipcRenderer.send('note:done'),
  onOut: cb => { ipcRenderer.on('note:out', () => cb()); }
});
