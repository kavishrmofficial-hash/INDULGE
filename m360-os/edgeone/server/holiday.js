/* holiday: the day before a holiday, once, from the server. An announcement on the feed as the owner
   (pinned, so it heads Home for everyone), a mail to every active person with an email, and a mark
   in settings/app.holNotes so no page posts it again. Runs at the first request of that day. */
const FIXED = {'01-26': 'Republic Day', '05-01': 'Maharashtra Day', '08-15': 'Independence Day', '10-02': 'Gandhi Jayanti', '12-25': 'Christmas'};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = ymd => { const d = new Date(ymd + 'T00:00:00Z'); return DAYS[d.getUTCDay()].slice(0, 3) + ' ' + d.getUTCDate() + ' ' + MONS[d.getUTCMonth()]; };
export const holidayLine = ymd => { const name = FIXED[ymd.slice(5)] || ''; return 'Tomorrow, ' + fmtDay(ymd) + ', is a holiday' + (name ? ': ' + name : '') + '. m360 rests too.'; };

export function holidayNotice(h) {
  const {getJ, docKey, appSettings, ownerUid, sendMail, writeAs, ymdIST, env} = h;
  /* one look every ten minutes per instance (a holiday added this afternoon still gets its notice today) */
  const EVERY = env && env.HOLIDAY_RECHECK_MS != null ? Number(env.HOLIDAY_RECHECK_MS) : 600000;
  let nextAt = 0, busy = false;
  return async function run() {
    if (Date.now() < nextAt || busy) return;
    busy = true;
    try {
      nextAt = Date.now() + EVERY;
      const app = await appSettings();
      const tm = ymdIST(Date.now() + 86400000);
      const notes = Array.isArray(app.holNotes) ? app.holNotes : [];
      if (!Array.isArray(app.holidays) || !app.holidays.includes(tm) || notes.includes(tm)) return;
      const owner = await ownerUid();
      if (!owner) return;
      /* the mark goes first, so a second instance answering at the same moment finds it */
      await writeAs(owner, 'settings/app', {...app, holNotes: notes.concat([tm]).slice(-24), updated: Date.now()}, 'holiday notice ' + tm);
      const line = holidayLine(tm);
      const cur = (await getJ(docKey('feed/' + owner)).catch(() => null)) || {};
      const id = String(Date.now()) + Math.random().toString(36).slice(2, 6).padEnd(4, '0');
      const post = {id, kind: 'announce', text: line, at: Date.now(), auto: 'holiday'};
      const posts = [post].concat(Array.isArray(cur.posts) ? cur.posts : []).slice(0, 80);
      await writeAs(owner, 'feed/' + owner, {...cur, posts, pinned: owner + ':' + id}, 'holiday announcement');
      const team = (await getJ(docKey('roster/team')).catch(() => null)) || {};
      const members = team.members || {};
      for (const uid of Object.keys(members)) {
        if (members[uid] && members[uid].active === false) continue;
        const p = await getJ('p/' + uid).catch(() => null);
        if (!p || !p.email) continue;
        await sendMail(p.email, 'Tomorrow is a holiday', line + '\n\nThis is the m360 OS calendar, one day ahead.', '<p>' + line + '</p><p>This is the m360 OS calendar, one day ahead.</p>').catch(() => {});
      }
    } catch (e) { /* the next look tries again */ }
    finally { busy = false; }
  };
}
