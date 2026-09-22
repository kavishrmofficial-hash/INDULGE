/* m360 OS root: boot gate, roster gate, mount. */
'use strict';
(function () {
  const {html, React} = M;

  function RosterGate() {
    const ctx = M.useCtx();
    if (!ctx.ready) return M.GateFor('boot');
    const onRoster = ctx.member && ctx.member.active !== false;
    if (!ctx.isFounder && !onRoster) return M.GateFor('roster');
    return html`<${M.Shell}/>`;
  }

  function Root() {
    const [boot, setBoot] = React.useState(null);
    React.useEffect(() => {
      let live = true;
      M.boot().then(b => { if (live) setBoot(b); });
      return () => { live = false; };
    }, []);
    if (!boot) return M.GateFor('boot');
    if (boot.mode !== 'ok') return M.GateFor(boot.mode);
    return html`<${M.AppState} boot=${boot}><${RosterGate}/><//>`;
  }

  const rootEl = document.getElementById('root');
  ReactDOM.createRoot(rootEl).render(html`<${Root}/>`);
})();
