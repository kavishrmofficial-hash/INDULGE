/* module: when. The date reader behind prospects: "after the 16th", "next Tuesday", "in two weeks",
   "end of month", "parso", "agle hafte", read with no model call. Pure functions, IST throughout: the
   day is the one in Asia/Kolkata whatever the device clock says, as the COO keeps it. A default-time date
   that lands on a Sunday or a holiday rolls forward and says why. "By the 16th" means the 16th itself.
   A festival ("after Diwali") comes back as a question, never a guess. Nothing here reads the agent's
   timeFrom, which takes "on 16" for a time of day. */
'use strict';
(function () {
  const {U} = M;
  const IST_MS = 330 * 60000;
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, '0');
  const YMD = /^\d{4}-\d{2}-\d{2}$/;
  /* a day as a UTC midnight, for arithmetic only; the device's own zone never enters */
  const ms0 = ymd => Date.parse(String(ymd) + 'T00:00:00Z');
  const fromMs0 = ms => new Date(ms).toISOString().slice(0, 10);
  const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
  const ok = s => YMD.test(String(s || '')) && !isNaN(ms0(s));

  const ist = {
    ymd: ms => new Date(ms + IST_MS).toISOString().slice(0, 10),
    hm: ms => { const d = new Date(ms + IST_MS); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); },
    /* the moment a day and an IST wall time name */
    at: (ymd, hm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '10:00').trim()); const h = m ? Number(m[1]) : 10, mi = m ? Number(m[2]) : 0; return ms0(ymd) - IST_MS + (h * 60 + mi) * 60000; },
    add: (ymd, n) => fromMs0(ms0(ymd) + n * DAY),
    dow: ymd => new Date(ms0(ymd)).getUTCDay(),
    ok
  };

  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const DS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MON = {jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
    aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11};
  const NUM = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1, couple: 2};
  const FEST = /^(diwali|dussehra|navratri|holi|eid|ganpati|ganesh chaturthi|christmas|new year|pongal|onam|rakhi|raksha bandhan)\b/;
  const ORD = '(\\d{1,2})(?:st|nd|rd|th)?';
  const MONS = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const WD = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday|mon|tue|tues|wed|thu|thur|thurs|fri|sat)';

  const dayOf = ymd => Number(String(ymd).slice(8, 10));
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th');
  const defaultWork = s => ist.dow(s) !== 0;
  const workOf = fn => typeof fn === 'function' ? (s => { try { return !!fn(s); } catch (e) { return defaultWork(s); } }) : defaultWork;

  /* the next working day on or after s, and where it came from when it moved */
  function roll(s, isWork) {
    let d = s, n = 0;
    while (!isWork(d) && n++ < 14) d = ist.add(d, 1);
    return {ymd: d, rolled: d !== s ? s : ''};
  }
  /* the next date carrying day-of-month n on or after today; a month without that day is skipped */
  function dayN(today, n, strictlyAfter) {
    const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)) - 1;
    for (let k = 0; k < 14; k++) {
      const c = utc(y, m + k, n);
      if (c.getUTCDate() !== n) continue;
      const s = fromMs0(c.getTime());
      if (strictlyAfter ? s > today : s >= today) return s;
    }
    return null;
  }
  /* a day with a month, this year or the next when it has passed */
  function mk(today, d, mo, yr) {
    if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
    const y0 = Number(today.slice(0, 4));
    const y = yr ? (Number(yr) < 100 ? 2000 + Number(yr) : Number(yr)) : y0;
    let c = utc(y, mo, d);
    if (c.getUTCDate() !== d) return null;
    if (!yr && fromMs0(c.getTime()) < today) c = utc(y + 1, mo, d);
    return fromMs0(c.getTime());
  }
  /* explicit dates: "16 oct", "oct 16", "16/10", "16th of october", "the 16th", "18th" */
  function explicit(today, str) {
    let x;
    if ((x = new RegExp('\\b' + ORD + '(?: of)? ' + MONS + '\\b').exec(str))) return mk(today, Number(x[1]), MON[x[2]]);
    if ((x = new RegExp('\\b' + MONS + ' ' + ORD + '\\b').exec(str))) return mk(today, Number(x[2]), MON[x[1]]);
    if ((x = /\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/.exec(str))) return mk(today, Number(x[1]), Number(x[2]) - 1, x[3]);
    if ((x = new RegExp('\\b(?:the )' + ORD + '\\b').exec(str)) || (x = /\b(\d{1,2})(?:st|nd|rd|th)\b/.exec(str))) return dayN(today, Number(x[1]), false);
    if ((x = /^\s*(\d{1,2})\s*$/.exec(str))) return dayN(today, Number(x[1]), false);
    return null;
  }
  /* "tuesday" is the coming one; "next tuesday" is the one in next week; "this friday" is this week's */
  function weekday(today, str) {
    const x = new RegExp('\\b(next |this |coming )?' + WD + '\\b').exec(str);
    if (!x) return null;
    const full = DAYS.find(dd => dd.startsWith(x[2].slice(0, 3)));
    const want = DAYS.indexOf(full);
    const tdow = ist.dow(today);
    let diff = (want - tdow + 7) % 7;
    if (diff === 0) diff = 7;
    let d = ist.add(today, diff);
    if (x[1] === 'next ') {
      const mon0 = ist.add(today, ((1 - tdow + 7) % 7) || 7);
      if (d < mon0) d = ist.add(d, 7);
      return {ymd: d, next: true, alt: ist.add(today, diff)};
    }
    return {ymd: d, next: false};
  }

  /* a time of day: "at 4" is 16:00, "11am" is 11:00, "at 4:30 pm"; a bare hour of 8 or less is afternoon */
  function time(text) {
    const s = String(text || '').toLowerCase();
    const m = /\b(?:at|@|around) (\d{1,2})(?::(\d{2}))? ?(am|pm|a\.m\.|p\.m\.)?\b|\b(\d{1,2})(?::(\d{2}))? ?(am|pm|a\.m\.|p\.m\.)/.exec(s);
    if (!m) return '';
    let h = Number(m[1] || m[4]), mm = Number(m[2] || m[5] || 0);
    const ap = (m[3] || m[6] || '').replace(/\./g, '');
    if (h > 24 || mm > 59) return '';
    if (ap === 'pm' && h < 12) h += 12;
    else if (ap === 'am' && h === 12) h = 0;
    else if (!ap && h <= 8) h += 12;
    return h < 24 ? pad(h) + ':' + pad(mm) : '';
  }

  /* the reader. {ymd, t?, after?, by?, said, rolledFrom?, next?, alt?}, or {festival}, or null */
  function parse(text, nowMs, isWorkingDay) {
    const isWork = workOf(isWorkingDay);
    const now = Number(nowMs) || Date.now();
    const today = ist.ymd(now);
    const s = ' ' + String(text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim() + ' ';
    const tm = time(s);
    const out = (d, said, extra) => {
      const r = roll(d, isWork);
      const o = {ymd: r.ymd, said: String(said || '').trim(), rolledFrom: r.rolled, ...(extra || {})};
      if (tm) o.t = tm;
      return o;
    };
    let m;
    if (/\bday after tomorrow\b|\bparso\b/.test(s)) return out(ist.add(today, 2), 'day after tomorrow');
    /* after X: the day after X. "16 ke baad" puts the day first. "post" only when a date follows it, so
       "post the deck" stays a verb */
    const afterRest = (m = /\bafter\b ?(.*)$/.exec(s)) ? m[1] : (m = /^(.*)\bke baad\b/.exec(s)) ? m[1]
      : (m = new RegExp('\\bpost (?=(?:the )?\\d|' + WD.slice(1, -1) + '|' + MONS.slice(1, -1) + '|diwali|dussehra|navratri|holi|eid|ganpati|christmas|new year)(.*)$').exec(s)) ? m[1] : null;
    if (afterRest !== null) {
      const rest = afterRest.trim();
      const f = FEST.exec(rest);
      if (f) return {festival: f[1]};
      let base = explicit(today, rest), w = null;
      if (!base && (w = weekday(today, rest))) base = w.ymd;
      if (!base && /\bthis week\b/.test(rest)) base = ist.add(today, (6 - ist.dow(today) + 7) % 7);
      if (!base && /\b(the )?weekend\b/.test(rest)) base = ist.add(today, ((0 - ist.dow(today) + 7) % 7) || 7);
      if (!base && /\b(tomorrow|tmrw|kal)\b/.test(rest)) base = ist.add(today, 1);
      if (!base && /\b(lunch|today)\b/.test(rest)) base = today;
      if (base) return out(ist.add(base, 1), /\bafter\b/.test(s) ? 'after ' + rest.replace(/[,.].*$/, '') : rest.replace(/^.*[,.]/, '').trim() + ' ke baad', {after: base});
    }
    /* by X: that day itself */
    if ((m = /\bby ((?:the )?.+)$/.exec(s)) && !/\bby (the )?(end|eod|evening|tonight|lunch)\b/.test(s)) {
      const w = weekday(today, m[1]);
      const b = explicit(today, m[1]) || (w ? w.ymd : null);
      if (b) return out(b, 'by ' + m[1].replace(/[,.].*$/, ''), {by: b});
    }
    if (/\btomorrow\b|\btmrw\b|\btomo\b/.test(s)) return out(ist.add(today, 1), 'tomorrow');
    if (/\btoday\b|\bthis evening\b|\btonight\b/.test(s)) return {ymd: today, said: 'today', rolledFrom: '', ...(tm ? {t: tm} : {})};
    if ((m = /\bin (\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an|a couple of|couple of) (day|days|week|weeks|month|months)\b/.exec(s))) {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM[m[1].replace(/^a couple of$|^couple of$/, 'couple')];
      const u = m[2][0];
      if (u === 'm') { const y = Number(today.slice(0, 4)), mo = Number(today.slice(5, 7)) - 1; return out(fromMs0(utc(y, mo + n, dayOf(today)).getTime()), m[0]); }
      return out(ist.add(today, u === 'w' ? n * 7 : n), m[0]);
    }
    if (/\bnext week\b|\bagle hafte\b|\bagle week\b/.test(s)) return out(ist.add(today, ((1 - ist.dow(today) + 7) % 7) || 7), 'next week');
    if (/\b(end of (the )?week|this weekend|by the weekend|weekend)\b/.test(s)) return out(ist.add(today, (6 - ist.dow(today) + 7) % 7), 'end of the week');
    if (/\b(end of (the )?month|month end|month-end)\b/.test(s)) {
      const y = Number(today.slice(0, 4)), mo = Number(today.slice(5, 7)) - 1;
      let d = fromMs0(utc(y, mo + 1, 0).getTime());
      let n = 0;
      while (!isWork(d) && n++ < 14) d = ist.add(d, -1);
      return {ymd: d, said: 'end of the month', rolledFrom: '', ...(tm ? {t: tm} : {})};
    }
    if (/\bnext month\b|\bagle mahine\b/.test(s)) { const y = Number(today.slice(0, 4)), mo = Number(today.slice(5, 7)) - 1; return out(fromMs0(utc(y, mo + 1, 1).getTime()), 'next month'); }
    const dated = /\b(on|for) (the )?/.test(s) || /\b\d{1,2}(st|nd|rd|th)\b|\b\d{1,2}[\/.]\d{1,2}\b/.test(s) || new RegExp('\\b' + MONS + '\\b').test(s);
    const e = dated ? explicit(today, s) : null;
    if (e) { const x = /\b(?:on|for) (the )?(\d{1,2}(?:st|nd|rd|th)?(?: [a-z]+)?)/.exec(s); return out(e, x ? 'on the ' + x[2].replace(/^(\d{1,2})$/, (q, n) => ordinal(Number(n))) : 'the date'); }
    const w = weekday(today, s);
    if (w) return out(w.ymd, (w.next ? 'next ' : '') + DAYS[ist.dow(w.ymd)], w.next ? {next: true, alt: w.alt} : {});
    return null;
  }

  const offIst = () => { try { return new Date().getTimezoneOffset() !== -330; } catch (e) { return false; } };
  /* 'Sat 17 Oct', or 'Sat 17 Oct at 10:00' (with ' IST' when this device is not on IST) */
  function label(ymd, t) {
    if (!ok(ymd)) return '';
    const d = new Date(ms0(ymd));
    const day = DS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MS[d.getUTCMonth()];
    return t ? day + ' at ' + t + (offIst() ? ' IST' : '') : day;
  }
  /* the date read back in words, with the reason when it moved: 'Mon 19 Oct, the 18th is a Sunday' */
  function readBack(r) {
    if (!r) return '';
    if (r.festival) return 'Which day is ' + U.cap(r.festival) + ' this year?';
    if (!ok(r.ymd)) return '';
    let s = label(r.ymd, r.t);
    if (r.rolledFrom && ok(r.rolledFrom)) s += ', the ' + ordinal(dayOf(r.rolledFrom)) + ' is a ' + (ist.dow(r.rolledFrom) === 0 ? 'Sunday' : 'holiday');
    return s;
  }
  /* days since ymd in IST: 2 on the second day after, 0 on the day, negative ahead */
  const lateDays = (ymd, nowMs) => ok(ymd) ? Math.round((ms0(ist.ymd(Number(nowMs) || Date.now())) - ms0(ymd)) / DAY) : 0;
  /* n working days on from ymd */
  function workDay(ymd, n, isWorkingDay) {
    const isWork = workOf(isWorkingDay);
    let d = ymd, k = 0, guard = 0;
    while (k < n && guard++ < 60) { d = ist.add(d, 1); if (isWork(d)) k++; }
    return d;
  }
  const dayName = ymd => ok(ymd) ? U.cap(DAYS[ist.dow(ymd)]) : '';

  M.when = {ist, parse, time, label, readBack, lateDays, workDay, ordinal, dayName, DAYS, DS, MS};
})();
