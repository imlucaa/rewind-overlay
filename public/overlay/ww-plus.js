// rewind-overlay-plus: what Wheel Wizard+ adds to the Rewind VR overlay, done in the browser.
// The overlay page itself is MichaelAccount1's Rewind Overlay (MIT, see LICENSE-rewind-overlay.txt). This script runs
// before it and adds, from the link's settings:
//   colours (colors=vr-gain-loss-rank), no card (card=off), race HUD digits (digits=hud), the race HUD font for the
//   name and the rest (text=hud), the race HUD VR change (vrhud=1), the rank badge (rank=on, bs, bg, ro, rw),
//   and the RR Lounge MMR (src=mmr, ladder=rr|ct|tt) or MKW Lounge LR (src=mkw, ladder=rt|ct) in place of the VR (ln=<lounge name>, flag=on).
(() => {
  const q = new URLSearchParams(location.search);
  const base = new URL('.', document.currentScript.src).href;
  const hex = value => (/^[0-9a-fA-F]{6}$/.test(value || '') ? '#' + value : null);
  // src=mkw: the MKW Lounge (mkwlounge.gg) LR, read the same way as the RR Lounge MMR (ladder=rt|ct).
  const mkw = q.get('src') === 'mkw';
  const mmr = q.get('src') === 'mmr' || mkw;
  const ladder = mkw
    ? (['rt', 'ct'].includes(q.get('ladder')) ? q.get('ladder') : 'rt')
    : ['rr', 'ct', 'tt'].includes(q.get('ladder')) ? q.get('ladder') : 'rr';
  const loungeName = (q.get('ln') || '').trim();
  const realFetch = window.fetch.bind(window);

  // ---------- styles ----------
  const css = [];
  const [vrColor, gainColor, lossColor, rankColor] = (q.get('colors') || '').split('-').map(hex);
  const vr = vrColor || '#8effc6';
  const gain = gainColor || '#5ef0a5';
  const loss = lossColor || '#ff6d7e';
  const rankTint = rankColor || '#ffe88f';
  css.push(
    `.vr-value{color:${vr};--change-color:${gain};--change-glow:${gain}}`,
    `.vr-value.change-negative{--change-color:${loss};--change-glow:${loss}}`,
    `.delta.positive{color:${gain};background:${gain}30}.delta.negative{color:${loss};background:${loss}30}`,
    `.positive{color:${gain}!important}.negative{color:${loss}!important}.rank-chip{color:${rankTint}}`,
  );
  if (q.get('card') === 'off')
    css.push(
      '.overlay-shell,.overlay-card{background:none!important;border:0!important;box-shadow:none!important;padding:0!important;animation:none!important}',
      '.overlay-shell::before,.overlay-shell::after,.overlay-card::before,.overlay-card::after{display:none!important}',
      '.background-layer,.background-fallback,.background-shade{display:none!important}',
    );
  const digits = q.get('digits') === 'hud';
  if (digits)
    css.push(
      '.vr-value{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}',
      '.element-vr-label{display:none!important}.delta{background:none!important;border:0!important;box-shadow:none!important}',
      '.delta-arrow{display:none!important}',
      '.rank-chip,.connection,.context-line>span{background:none!important;border:0!important;box-shadow:none!important}',
      '.connection>i{display:none!important}',
    );
  // Race HUD: the session change (the only context it keeps) sits under the VR and rank, right-aligned, not off to the left.
  if (q.get('vrhud') === '1')
    css.push(
      '.card-content{flex-direction:column!important;align-items:flex-end!important;justify-content:center!important;gap:2px!important}',
      '.identity-block{order:2}.context-line{margin-top:0!important;width:auto!important;justify-content:flex-end!important}',
      '.context-line span{font-size:12px!important}',
    );
  // Slim (look=slim): a thin pill, plain big number, the name small; the flag sits above the name and, for MMR, the
  // division takes the place of the "MMR" label.
  const slim = q.get('look') === 'slim';
  if (slim)
    css.push(
      '.card-content{padding:8px 30px!important;gap:16px!important}',
      '.player-name{font-size:18px!important;letter-spacing:0!important;opacity:.85}',
      `.vr-value{${q.get('nfont') ? '' : 'font-family:inherit!important;'}font-size:46px!important;font-weight:600!important;letter-spacing:-.01em!important;color:${hex(q.get('tc')) || '#ffffff'}!important;text-shadow:0 2px 10px #000c!important}`,
      '.meta-line{margin-top:-2px!important;min-height:0!important;justify-content:center!important;gap:6px!important}',
      '.vr-label{font-size:9px!important;letter-spacing:.22em!important}',
      // the glass blur leaks past the round ends in Chrome
      '.background-shade{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    );
  // Fonts (font=<Google Fonts name> for the text, nfont=<name> for the number). Two requests: one asks for the bold
  // weights, the plain one covers fonts that only come in one weight (that request just fails for those).
  const fontName = v => (/^[A-Za-z0-9 ]{1,40}$/.test(v || '') ? v.trim() : null);
  const loadFont = name => {
    const family = encodeURIComponent(name).replace(/%20/g, '+');
    for (const query of [`family=${family}:wght@400;500;600;700;800;900`, `family=${family}`]) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
      document.head.appendChild(link);
    }
  };
  const textFontName = fontName(q.get('font'));
  const numberFontName = fontName(q.get('nfont'));
  if (textFontName) {
    loadFont(textFontName);
    css.push(`.overlay-shell,.overlay-shell :not(.vr-value):not(.vr-value *){font-family:"${textFontName}",system-ui,sans-serif!important}`);
  }
  if (numberFontName) {
    if (numberFontName !== textFontName) loadFont(numberFontName);
    css.push(`.overlay-shell .vr-value,.overlay-shell .vr-value *{font-family:"${numberFontName}",system-ui,sans-serif!important}`);
  }
  // vl=off: no "VR"/"MMR" label (or division) under the number. cb=off: the change keeps its colour but loses its box.
  if (q.get('vl') === 'off') css.push('.element-vr-label{display:none!important}');
  if (q.get('cb') === 'off') css.push('.delta{background:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;padding-left:0!important;padding-right:0!important}');
  // MKW Lounge: the label under the number says LR.
  if (mkw) css.push('.vr-label{font-size:0!important}.vr-label::after{content:"LR";font-size:10px}');
  // The page's "PREVIEW MODE" pill never shows (not in the preview, not in OBS).
  css.push('.preview-mode-pill{display:none!important}');
  // The page opens on a made-up sample player (87,747). It stays hidden until the real number is in (or 6 s pass),
  // and the bundles skip counting from the sample, so switching shows the real number straight away.
  css.push('html.ww-wait #root,html.ww-wait #ww-layer{visibility:hidden!important}');
  document.documentElement.classList.add('ww-wait');
  const waitStart = performance.now();
  const waitTimer = setInterval(() => {
    const text = document.querySelector('.vr-value')?.textContent || '';
    if ((text && text.replace(/\D/g, '') !== '87747') || performance.now() - waitStart > 6000) {
      clearInterval(waitTimer);
      document.documentElement.classList.remove('ww-wait');
    }
  }, 50);
  const style = document.createElement('style');
  style.textContent = css.join('');
  document.head.appendChild(style);

  // ---------- RR Lounge MMR (the page asks ./ww-mmr/... and gets the Lounge player shaped like an rwfc.net one) ----------
  const lounge = { player: null, info: null, at: 0 };
  let mmrChange = null;
  // The settings page's "Play gain": a pretend race, drawn over the real numbers (race HUD only).
  let play = null;
  window.addEventListener('message', e => {
    if (!(e.data && e.data.ww === 'play-gain' && Number(e.data.gain))) return;
    if (q.get('vrhud') === '1') play = { gain: Number(e.data.gain), at: performance.now() };
    else playCard(Number(e.data.gain), Number(e.data.ms) || 1100);
  });

  // Card: the page's own animation plays on a pretend result (polling waits), then the real numbers come back
  // behind a quick fade so they don't animate backwards.
  let carding = false;
  function playCard(gain, ms) {
    // The live controller: the page may make others (a demo one), only one has real data and listeners.
    const ctl = (window.__wwOverlays || []).find(c => c.engine?.player?.source === 'rwfc' && c.listeners.size);
    if (carding || !ctl || ctl.busy) return;
    carding = true;
    ctl.busy = true;
    const saved = ctl.engine.player;
    const rank = saved.rank;
    ctl.engine.player = {
      ...saved,
      previousVr: saved.vr,
      vr: saved.vr + gain,
      vrDelta: gain,
      ...(rank ? { previousRank: rank, rank: Math.max(1, rank - Math.sign(gain)), rankDelta: Math.sign(gain) } : {}),
      updatedAt: new Date().toISOString(),
    };
    ctl.emitChange();
    setTimeout(() => {
      // The drawn layer (badge, game digits) fades with the card, or the badge is left alone on screen for a moment.
      const faded = [document.getElementById('root') || document.body, document.getElementById('ww-layer')].filter(Boolean);
      for (const el of faded) {
        el.style.transition = 'opacity .2s';
        el.style.opacity = '0';
      }
      setTimeout(() => {
        ctl.engine.player = saved;
        ctl.emitChange();
        setTimeout(() => {
          for (const el of faded) el.style.opacity = '';
          ctl.busy = false;
          carding = false;
        }, 350);
      }, 220);
    }, ms + 1600);
  }
  let extras = null;

  async function loungeExtras() {
    // Country and division come from the leaderboard page, which a browser may not read; a GitHub Action copies them
    // into data/lounge-<ladder>.json every 30 minutes.
    if (!extras)
      extras = realFetch(new URL(`../data/lounge-${ladder}.json`, base), { cache: 'no-cache' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
    return extras;
  }

  // One read every 30 s; callers that come while it runs wait for the same read.
  function loungePlayer() {
    if (Date.now() - lounge.at >= 30000) {
      lounge.at = Date.now();
      lounge.pending = readLounge();
    }
    return lounge.pending;
  }

  // MKW Lounge divisions (by LR) and their colours; the emblems are in overlay/mkw/.
  const mkwColours = {
    iron: '#9a9a9a', copper: '#e07a4f', bronze: '#e89a3c', silver: '#d4dbe3', gold: '#f5c518', platinum: '#41d3d9',
    emerald: '#3fcf5c', ruby: '#ec3355', diamond: '#8fe6ff', master: '#a99bc4', grandmaster: '#ef2c45',
  };

  async function readMkw() {
    try {
      const url = `https://www.mkwlounge.gg/api/ladderplayer.php?ladder_type=${ladder}&player_name=${encodeURIComponent(loungeName)}`;
      // The answer starts with blank lines, so it is read as text first.
      const found = JSON.parse((await (await realFetch(url, { cache: 'no-store' })).text()).trim()).results?.[0];
      if (found) {
        const division = String(found.current_division || '');
        const key = division.toLowerCase();
        lounge.player = { name: found.player_name, mmr: found.current_lr, rank: parseInt(found.ranking, 10) || 0 };
        lounge.info = {
          country: found.player_country_flag || null,
          icon: mkwColours[key] ? base + 'mkw/' + key + '.png' : null,
          division: division || null,
          color: mkwColours[key] || null,
        };
      }
    } catch (e) {
      // Offline: the last numbers stay.
    }
    return lounge.player;
  }

  // RR Lounge's division emblems are 1.2-1.9 MB each; overlay/lounge/ has 256 px copies (about 15 KB). An emblem
  // not copied yet still loads from rr-lounge.com.
  const LOCAL_ICONS = ['amethyst', 'bronze', 'diamond', 'diamond_outline', 'emerald', 'gold', 'legend', 'master', 'opal', 'platinum', 'ruby', 'silver'];
  function divisionIcon(path) {
    if (!path) return null;
    const name = /^\/icons\/new_([a-z_]+)\.png$/.exec(path)?.[1];
    const url = name && LOCAL_ICONS.includes(name) ? base + 'lounge/new_' + name + '.webp' : 'https://rr-lounge.com' + path;
    new Image().src = url; // start loading before the overlay draws it
    return url;
  }

  async function readLounge() {
    if (mkw) return readMkw();
    try {
      // Both start at once: the division data doesn't wait for the leaderboard.
      const extrasLoading = loungeExtras();
      const board = await (await realFetch(`https://rr-lounge.com/api/leaderboard?category=${ladder}`, { cache: 'no-store' })).json();
      const found = (board.players || []).find(p => p.name.toLowerCase() === loungeName.toLowerCase());
      if (found) {
        const data = await extrasLoading;
        const tiers = (data?.tiers || []).slice().sort((a, b) => b.minMmr - a.minMmr);
        const tier = tiers.find(t => found.mmr >= t.minMmr) || null;
        lounge.player = found;
        lounge.info = {
          country: data?.countries?.[found.id] || null,
          icon: divisionIcon(tier?.icon),
          division: tier?.name || null,
          color: tier?.color || null,
        };
      }
    } catch (e) {
      // Offline: the last numbers stay.
    }
    return lounge.player;
  }

  const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (mmr) {
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      if (!url.includes('/ww-mmr/')) return realFetch(input, init);
      if (url.includes('/ww-mmr/rooms')) return json({ rooms: [] });
      // No VR history on the Lounge: an empty list. (A 404 here would break the page, which builds an absolute URL from
      // this relative one to report it.)
      if (/\/history\//.test(url)) return json([]);
      if (/\/mii\//.test(url)) return new Response('', { status: 404 });
      const p = await loungePlayer();
      if (!p) return new Response('', { status: 404 });
      // The page only keeps a player whose friend code is the one it asked for, so it is echoed back.
      const friendCode = decodeURIComponent(url.split('/ww-mmr/player/')[1] || '').split(/[/?#]/)[0];
      // The page shows what it is answered, so a change here is the change on screen: the race HUD counts it down.
      if (lounge.shown !== undefined && p.mmr !== lounge.shown) mmrChange = { delta: p.mmr - lounge.shown, from: lounge.shown };
      lounge.shown = p.mmr;
      return json({ pid: 'rr-lounge', name: p.name, friendCode, vr: p.mmr, rank: p.rank, isSuspicious: false });
    };
    // Card: the page only knows a change from VR history, which the Lounge doesn't have. Once the new MMR is on screen
    // the change is handed to the page, so its +/- pill shows like for VR.
    if (q.get('vrhud') !== '1')
      setInterval(() => {
        const ctl = (window.__wwOverlays || []).find(c => c.engine?.player?.source === 'rwfc' && c.listeners.size);
        if (!ctl || !mmrChange || mmrChange.card || carding) return;
        const shown = ctl.engine.player;
        if (shown.vr !== mmrChange.from + mmrChange.delta) return;
        mmrChange.card = true;
        ctl.engine.player = { ...shown, previousVr: mmrChange.from, vrDelta: mmrChange.delta };
        ctl.emitChange();
      }, 250);
    // The country flag before the name.
    if (q.get('flag') === 'on')
      loungePlayer().then(() => {
        const country = lounge.info?.country;
        if (country && /^[a-z]{2}$/i.test(country))
          style.textContent += slim
            ? `.player-name{padding-top:1.05em;background:url(https://flagcdn.com/w80/${country.toLowerCase()}.png) left top/1.2em .85em no-repeat}`
            : `.player-name{padding-left:1.55em;background:url(https://flagcdn.com/w80/${country.toLowerCase()}.png) left center/1.3em .95em no-repeat}`;
      });
    // Slim: the division (BRONZE, SILVER, ...) in its own colour under the number.
    if (slim) {
      const label = document.createElement('style');
      document.head.appendChild(label);
      let said = '';
      // db=on: a small black box behind the division so it reads on any picture.
      const backing = q.get('db') === 'on' ? ';background:#000c;padding:2px 6px;border-radius:4px' : '';
      setInterval(() => {
        const { division, color } = lounge.info || {};
        const text = division ? `.vr-label{font-size:0!important}.vr-label::after{content:${JSON.stringify(division.toUpperCase())};font-size:9px;color:${color || 'inherit'}${backing}}` : '';
        if (text !== said) label.textContent = said = text;
      }, 1000);
    }
  }

  // ---------- no card: centre what is drawn ----------
  // The card's layout puts the name left and the numbers right; without the card that leaves them off to one side.
  // Each frame the visible parts (plus the drawn digits and badge) are measured and the whole is moved to the middle.
  if (q.get('card') === 'off') {
    const shown = el => {
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    const centre = () => {
      const shell = document.querySelector('.overlay-shell');
      if (shell) {
        let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
        const add = rect => {
          if (rect.width <= 0 || rect.height <= 0) return;
          l = Math.min(l, rect.left); r = Math.max(r, rect.right);
          t = Math.min(t, rect.top); b = Math.max(b, rect.bottom);
        };
        for (const el of shell.querySelectorAll('*')) {
          const leaf = /^(IMG|CANVAS|SVG)$/i.test(el.tagName) || (!el.firstElementChild && el.textContent.trim());
          if (leaf && shown(el)) add(el.getBoundingClientRect());
        }
        for (const el of document.querySelectorAll('#ww-layer > div:not([data-side]) > *')) add(el.getBoundingClientRect());
        if (l < r) {
          const [x, y] = (shell.style.translate || '0px 0px').split(' ').map(v => parseFloat(v) || 0);
          const dx = innerWidth / 2 - (l + r) / 2;
          const dy = innerHeight / 2 - (t + b) / 2;
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) shell.style.translate = `${Math.round(x + dx)}px ${Math.round(y + dy)}px`;
        }
      }
      requestAnimationFrame(centre);
    };
    requestAnimationFrame(centre);
  }

  // ---------- the overlay page itself ----------
  const page = document.createElement('script');
  page.type = 'module';
  page.crossOrigin = '';
  page.src = base + 'assets/' + (mmr ? 'mmr-' : '') + 'index-CPppRstO.js?v=32';
  document.head.appendChild(page);

  // ---------- stream stats under the overlay: goal=<n>, nr=on (to next rank), rc=on (races), ws=on (streak) ----------
  // Counted from the page's own player data, not the number on screen (that one counts up during a change). A test
  // race from the settings page doesn't count.
  const goal = parseInt(q.get('goal'), 10) || 0;
  const showNext = q.get('nr') === 'on' && !mmr;
  const showRaces = q.get('rc') === 'on';
  const showStreak = q.get('ws') === 'on';
  if (goal > 0 || showNext || showRaces || showStreak) {
    const unit = mkw ? 'LR' : mmr ? 'MMR' : 'VR';
    const steps = [[24000, 'D rank'], [36000, 'C rank'], [48000, 'B rank'], [60000, 'A rank'], [72000, 'Star rank'], [84000, '2 star rank'], [94000, '3 star rank'], [100000, 'Crown']];
    const fmt = n => Math.round(n).toLocaleString('en-US');
    const hud = q.get('vrhud') === '1';
    const plain = q.get('card') === 'off' || hud;
    style.textContent +=
      '#ww-stats{position:fixed;z-index:2147483646;display:flex;flex-wrap:wrap;gap:6px;pointer-events:none;font-weight:700;letter-spacing:.02em}' +
      `#ww-stats>span{white-space:nowrap;padding:${plain ? '0' : '.3em .75em'};border-radius:99px;color:${hex(q.get('mc')) || '#c9d1e7'};${plain ? 'text-shadow:0 1px 4px #000c' : 'background:#090b12b8'}}` +
      `#ww-stats b{color:${hex(q.get('tc')) || '#ffffff'}}#ww-stats .up{color:${gain}}` +
      '#ww-stats .goal{flex:1 1 100%;display:flex;align-items:center;gap:.6em;padding:0;background:none}' +
      `#ww-stats .goal i{flex:1;height:.45em;border-radius:99px;background:linear-gradient(90deg,${gain} var(--p),#ffffff26 var(--p));box-shadow:0 1px 4px #0008}` +
      // Race HUD: its letters are wider than the page's, so the bar goes under the words, not beside them.
      (hud ? '#ww-stats .goal{flex-direction:column;align-items:flex-end;gap:.35em}#ww-stats .goal i{flex:none;width:100%}#ww-stats b{color:inherit}' : '');
    const box = document.createElement('div');
    box.id = 'ww-stats';
    const session = { start: null, last: null, races: 0, up: 0, down: 0, streak: 0 };
    let said = '';
    const tick = () => {
      if (!box.isConnected && document.body) document.body.appendChild(box);
      const ctl = (window.__wwOverlays || []).find(c => c.engine?.player?.source === 'rwfc' && c.listeners.size);
      const shell = document.querySelector('.overlay-shell');
      const v = ctl?.engine?.player?.vr;
      if (!shell || typeof v !== 'number' || document.documentElement.classList.contains('ww-wait')) {
        box.style.display = 'none';
        return;
      }
      if (!carding && !ctl.busy) {
        // 87,747 is the page's sample player, shown before the real one loads.
        if (session.last === null || session.last === 87747) session.start = session.last = v;
        else if (v !== session.last) {
          session.races++;
          if (v > session.last) {
            session.up++;
            session.streak++;
          } else {
            session.down++;
            session.streak = 0;
          }
          session.last = v;
        }
      }
      const now = session.last;
      const parts = [];
      if (goal > 0) {
        const done = now >= goal;
        // The bar fills from where the stream started, so it moves with each race.
        const from = Math.min(session.start, goal);
        const p = done ? 1 : goal > from ? Math.max(0, (now - from) / (goal - from)) : 0;
        parts.push(`<span class="goal"><span>${done ? '<b>Goal reached</b>' : `<b>${fmt(goal - now)}</b> ${unit} to goal`}</span><i style="--p:${(p * 100).toFixed(1)}%"></i></span>`);
      }
      if (showNext) {
        const next = steps.find(([at]) => now < at);
        parts.push(next ? `<span><b>${fmt(next[0] - now)}</b> VR to ${next[1]}</span>` : '<span>Top rank</span>');
      }
      if (showRaces)
        parts.push(
          session.races
            ? `<span><b>${session.races}</b> race${session.races === 1 ? '' : 's'} · <b>${session.up}</b> up · <b>${session.down}</b> down</span>`
            : '<span>No races yet</span>',
        );
      if (showStreak && session.streak >= 2) parts.push(`<span class="up">${session.streak} wins in a row</span>`);
      const html = parts.join('');
      if (html !== said) box.innerHTML = said = html;
      // Under the overlay, as wide as it, scaled with it. Without the card, under what is actually shown (the card's
      // box is bigger than that), and on the race HUD lined up with the number on the right.
      const r = shell.getBoundingClientRect();
      const size = Math.max(9, (r.width / 560) * (hud ? 16 : 13));
      let { left, right, bottom } = r;
      if (plain) {
        left = Infinity;
        right = bottom = -Infinity;
        const add = b => {
          if (b.width <= 0 || b.height <= 0) return;
          left = Math.min(left, b.left);
          right = Math.max(right, b.right);
          bottom = Math.max(bottom, b.bottom);
        };
        for (const el of shell.querySelectorAll('*')) {
          const leaf = /^(IMG|CANVAS|SVG)$/i.test(el.tagName) || (!el.firstElementChild && el.textContent.trim());
          const cs = leaf && getComputedStyle(el);
          if (leaf && cs.visibility !== 'hidden' && cs.opacity !== '0' && cs.display !== 'none') add(el.getBoundingClientRect());
        }
        for (const el of document.querySelectorAll('#ww-layer > div:not([data-side]) > *')) add(el.getBoundingClientRect());
        if (left >= right) ({ left, right, bottom } = r);
      }
      box.style.cssText = `display:${html ? 'flex' : 'none'};left:${left}px;top:${bottom + size * 0.6}px;width:${right - left}px;font-size:${size}px;justify-content:${hud ? 'flex-end' : 'center'}`;
    };
    setInterval(tick, 250);
  }

  // ---------- race HUD digits, font and rank badge ----------
  const rank = q.get('rank') === 'on';
  if (!digits && !rank) return;

  // The game digits and letters are recoloured here: each pixel's brightness is kept, the yellow becomes the colour
  // (a little darker at the bottom), and the empty sides are cut so the letters sit close like in the game.
  const prepared = new Map();
  const coloured = new Map();
  const loadImage = src =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });

  function prepare(file) {
    if (!prepared.has(file))
      prepared.set(
        file,
        loadImage(base + 'font/' + file + '.png').then(image => {
          const scale = 4;
          const w = image.width * scale;
          const h = image.height * scale;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(image, 0, 0, w, h);
          const px = ctx.getImageData(0, 0, w, h).data;
          const alpha = new Float32Array(w * h);
          const light = new Float32Array(w * h);
          let first = w;
          let last = -1;
          for (let i = 0; i < w * h; i++) {
            alpha[i] = Math.min(1, Math.max(0, 0.5 + (px[i * 4 + 3] / 255 - 0.5) * 3.2));
            light[i] = Math.min(1, Math.max(px[i * 4], px[i * 4 + 1]) / 235);
            if (alpha[i] >= 0.5) {
              const x = i % w;
              if (x < first) first = x;
              if (x > last) last = x;
            }
          }
          if (last < first) [first, last] = [0, w - 1];
          return { w, h, alpha, light, left: Math.max(0, first - 2), right: Math.min(w, last + 3) };
        }),
      );
    return prepared.get(file);
  }

  function rgb(color) {
    const v = /^#?([0-9a-f]{6})$/i.exec(color || '')?.[1] || 'f2f20a';
    return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16));
  }

  function glyph(file, color) {
    const key = file + '|' + color;
    if (!coloured.has(key))
      coloured.set(
        key,
        prepare(file).then(g => {
          const top = rgb(color);
          const bottom = top.map(v => v * 0.75);
          const width = g.right - g.left;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = g.h;
          const ctx = canvas.getContext('2d');
          const out = ctx.createImageData(width, g.h);
          for (let y = 0; y < g.h; y++) {
            const t = y / (g.h - 1);
            const base = top.map((v, i) => v + (bottom[i] - v) * t);
            for (let x = 0; x < width; x++) {
              const i = y * g.w + g.left + x;
              const o = (y * width + x) * 4;
              out.data[o] = base[0] * g.light[i];
              out.data[o + 1] = base[1] * g.light[i];
              out.data[o + 2] = base[2] * g.light[i];
              out.data[o + 3] = g.alpha[i] * 255;
            }
          }
          ctx.putImageData(out, 0, 0);
          return canvas.toDataURL();
        }),
      );
    return coloured.get(key);
  }

  const textFont = q.get('text') === 'hud';
  const raceCount = q.get('vrhud') === '1';
  // vk=on: the change stays beside the number until the next one, instead of counting into it and going.
  const keepChange = raceCount && q.get('vk') === 'on';
  const badgeSize = Math.min(300, Math.max(30, parseFloat(q.get('bs')) || 100)) / 100;
  const badgeGap = Math.min(100, Math.max(0, parseFloat(q.get('bg') ?? '15'))) / 100;
  const ro = hex(q.get('ro'));
  const rw = Math.min(10, Math.max(0.5, parseFloat(q.get('rw')) || 2));
  const outline = h =>
    ro
      ? [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]
          .map(([x, y]) => `drop-shadow(${x * h}px ${y * h}px 0 ${ro})`)
          .join(' ')
      : 'none';
  // Badge outline: the badge's own shape, grown evenly and filled with the colour, under the badge (like the white edge
  // of the Mario Kart World badges). Shadow tricks leave lumps at the corners; this stays smooth. rw sets how thick it
  // is. Made once per badge; null if the picture can't be read (another site without CORS).
  const outlinedBadges = new Map();
  const outlinedBadge = src => {
    if (!outlinedBadges.has(src))
      outlinedBadges.set(
        src,
        new Promise((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = src;
        })
          .then(image => {
            const scale = Math.max(1, 256 / image.height);
            const w = Math.round(image.width * scale);
            const h = Math.round(image.height * scale);
            // 0.5 still shows (about 1.5% of the height); 2 is about 3%, like the Lounge badges' own edge.
            const r = h * 0.01 * (1 + rw);
            const pad = Math.ceil(r) + 2;
            // The badge, with its dark outer frame taken off (the Retro Rewind ones have one): dark pixels reached from
            // outside without crossing a coloured one. The ring's colour then meets the outline, as on the Lounge badges.
            const art = document.createElement('canvas');
            art.width = w;
            art.height = h;
            const actx = art.getContext('2d', { willReadFrequently: true });
            actx.imageSmoothingQuality = 'high';
            actx.drawImage(image, 0, 0, w, h);
            const pixels = actx.getImageData(0, 0, w, h);
            const px = pixels.data;
            const open = i => px[i * 4 + 3] < 128 || Math.max(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) < 60;
            const seen = new Uint8Array(w * h);
            const todo = [];
            for (let x = 0; x < w; x++) todo.push(x, (h - 1) * w + x);
            for (let y = 0; y < h; y++) todo.push(y * w, y * w + w - 1);
            while (todo.length) {
              const i = todo.pop();
              if (seen[i] || !open(i)) continue;
              seen[i] = 1;
              const x = i % w;
              if (x > 0) todo.push(i - 1);
              if (x < w - 1) todo.push(i + 1);
              if (i >= w) todo.push(i - w);
              if (i < w * (h - 1)) todo.push(i + w);
            }
            for (let i = 0; i < w * h; i++) if (seen[i]) px[i * 4 + 3] = 0;
            actx.putImageData(pixels, 0, 0);
            const shape = document.createElement('canvas');
            shape.width = w;
            shape.height = h;
            const sctx = shape.getContext('2d');
            sctx.drawImage(art, 0, 0);
            sctx.globalCompositeOperation = 'source-in';
            sctx.fillStyle = ro;
            sctx.fillRect(0, 0, w, h);
            const canvas = document.createElement('canvas');
            canvas.width = w + pad * 2;
            canvas.height = h + pad * 2;
            const ctx = canvas.getContext('2d');
            for (let ring = 1; ring <= 4; ring++)
              for (let a = 0; a < 48; a++) {
                const d = (r * ring) / 4;
                const t = (a / 48) * Math.PI * 2;
                ctx.drawImage(shape, pad + Math.cos(t) * d, pad + Math.sin(t) * d);
              }
            ctx.drawImage(art, pad, pad);
            return { url: canvas.toDataURL(), grow: canvas.height / h };
          })
          .catch(() => null),
      );
    return outlinedBadges.get(src);
  };
  const specialty = ['tester', 'donor', 'translator', 'discord-staff', 'contributor', 'major-contributor', 'wfc-staff', 'developer'];
  const ranks = [[100000, 'crown'], [94000, '3star'], [84000, '2star'], [72000, 'star'], [60000, 'a'], [48000, 'b'], [36000, 'c'], [24000, 'd'], [0, 'e']];
  const mkwBadges = ['iron', 'copper', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'ruby', 'diamond', 'master', 'grandmaster'].map(d => 'mkw-' + d);
  const pickedBadge = [...ranks.map(t => t[1]), ...specialty, ...mkwBadges].includes(q.get('badge')) ? q.get('badge') : null;
  const tint = { name: hex(q.get('tc')) || '#ffffff', gain, loss, rank: rankTint, muted: hex(q.get('mc')) || '#c9d1e7' };
  const fileFor = c => (c === '-' ? 'dash' : c === '+' ? 'plus' : c);
  const clean = t =>
    t
      .replace(/▲/g, '+')
      .replace(/▼/g, '-')
      .toUpperCase()
      .replace(/[^0-9A-Z+\- ]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/([+-]) (?=[0-9])/g, '$1')
      .trim();
  const drawable = text => /^[0-9A-Z+\- ]+$/.test(text);
  // The page's own text is hidden under the drawn letters. Its .positive/.negative colours are !important, so this is too.
  const hide = el => {
    for (const k of ['color', 'background', 'text-shadow', 'backdrop-filter', '-webkit-backdrop-filter'])
      el.style.setProperty(k, k === 'color' ? 'transparent' : 'none', 'important');
  };
  let lastDelta = null;
  let vrStart = 0;

  function targets() {
    const list = [...document.querySelectorAll('.vr-value')].map(el => ({ el, kind: 'vr', text: (el.textContent || '').replace(/[^0-9-]/g, '') }));
    if (textFont) {
      for (const el of document.querySelectorAll('.player-name')) list.push({ el, kind: 'name', text: (el.textContent || '').trim().toUpperCase() });
      for (const el of document.querySelectorAll('.rank-chip > span')) list.push({ el, kind: 'extra', col: tint.rank, text: clean(el.textContent || '') });
      for (const el of document.querySelectorAll('.rank-chip > b'))
        list.push({ el, kind: 'extra', col: el.classList.contains('negative') ? tint.loss : tint.gain, text: clean(el.textContent || '') });
      for (const el of document.querySelectorAll('#ww-stats > span:not(.goal)'))
        list.push({ el, kind: 'extra', stat: true, col: el.classList.contains('up') ? tint.gain : tint.muted, text: clean(el.textContent || '') });
      for (const el of document.querySelectorAll('#ww-stats > .goal > span'))
        list.push({ el, kind: 'extra', stat: true, col: tint.muted, text: clean(el.textContent || '') });
      for (const el of document.querySelectorAll('.connection, .context-line > span'))
        list.push({
          el,
          kind: 'extra',
          col: el.classList.contains('positive') ? tint.gain : el.classList.contains('negative') ? tint.loss : tint.muted,
          text: clean(el.textContent || ''),
        });
      const vrNow = parseInt((document.querySelector('.vr-value')?.textContent || '').replace(/[^0-9-]/g, ''), 10) || 0;
      for (const el of document.querySelectorAll('.element-delta .delta')) {
        let text = (el.textContent || '').replace(/[^0-9+-]/g, '');
        if (raceCount) {
          hide(el);
          const delta = parseInt(text, 10) || 0;
          // The first change seen is an old one (already counted); a new one starts counting from here.
          if (lastDelta === null) vrStart = vrNow - delta;
          else if (text !== lastDelta) vrStart = vrNow;
          lastDelta = text;
          if (keepChange) {
            if (delta) list.push({ el, kind: 'delta', text: (delta > 0 ? '+' : '') + delta });
            continue;
          }
          const left = delta - (vrNow - vrStart);
          // More left than the change itself: the number jumped (the page loading), so it counts as done.
          if (Math.abs(left) > Math.abs(delta)) {
            vrStart = vrNow - delta;
            continue;
          }
          if (left === 0 || Math.sign(left) !== Math.sign(delta)) continue;
          text = (left > 0 ? '+' : '') + left;
        }
        list.push({ el, kind: 'delta', text });
      }
      const vrEl = document.querySelector('.vr-value');
      // MMR: the page has no change to show, so the one seen in the shim counts down beside the number.
      if (raceCount && mmr && mmrChange && vrEl && !list.some(t => t.kind === 'delta')) {
        const left = mmrChange.delta - (vrNow - mmrChange.from);
        if (keepChange) list.push({ el: vrEl, kind: 'side', text: (mmrChange.delta > 0 ? '+' : '') + mmrChange.delta });
        else if (left !== 0 && Math.sign(left) === Math.sign(mmrChange.delta) && Math.abs(left) <= Math.abs(mmrChange.delta))
          list.push({ el: vrEl, kind: 'side', text: (left > 0 ? '+' : '') + left });
        else if (vrNow === mmrChange.from + mmrChange.delta) mmrChange = null;
      }
      // Play gain: the change shows for a second, then counts into the number like in the game.
      if (raceCount && play && vrEl) {
        const t = (performance.now() - play.at) / 1000;
        const q = Math.min(1, Math.max(0, (t - 1) / 1.2));
        const added = Math.round(play.gain * q);
        // Keeping the change: the pretend one stays (whole) until the next, like a real race would.
        if (t > 2.6 && !keepChange) play = null;
        else {
          for (let i = list.length - 1; i >= 0; i--) if (list[i].kind === 'delta' || list[i].kind === 'side') list.splice(i, 1);
          const vr = list.find(i => i.kind === 'vr');
          if (vr) vr.text = String(vrNow - play.gain + added);
          const left = keepChange ? play.gain : play.gain - added;
          if (left) list.push({ el: vrEl, kind: 'side', text: (left > 0 ? '+' : '') + left });
        }
      }
    }
    return list.filter(t => t.text && drawable(t.text));
  }

  function start() {
    const layer = document.createElement('div');
    layer.id = 'ww-layer';
    layer.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483647';
    document.body.appendChild(layer);
    let last = '';
    function frame() {
      const items = targets()
        .map(t => {
          const r = t.el.getBoundingClientRect();
          const cs = getComputedStyle(t.el);
          return { ...t, r, size: parseFloat(cs.fontSize) || r.height, pad: parseFloat(cs.paddingLeft) || 0 };
        })
        .filter(i => i.r.width > 0 && (i.kind !== 'vr' || digits || rank));
      const key =
        (lounge.info?.icon || '') +
        items.map(i => i.kind + i.text + '|' + Math.round(i.r.left) + '|' + Math.round(i.r.right) + '|' + Math.round(i.r.top) + '|' + Math.round(i.size)).join(';');
      if (key !== last) {
        last = key;
        layer.textContent = '';
        for (const i of items) {
          const h = i.size * (i.kind === 'side' ? 0.55 : 1.08);
          const fontHere = i.kind === 'vr' ? digits : true;
          if (fontHere) hide(i.el);
          const box = document.createElement('div');
          // The name keeps its left edge; numbers keep their right edge. Without the digits the rank badge sits just
          // left of the page's own number.
          const side =
            i.kind === 'side'
              ? `left:${i.r.right + h * 0.25}px`
              : i.kind === 'name' || i.kind === 'extra'
              ? `left:${i.r.left + i.pad}px`
              : `right:${fontHere ? innerWidth - i.r.right : innerWidth - i.r.left + h * badgeGap}px`;
          if (i.kind === 'side' || i.stat) box.dataset.side = '1'; // the change and the stats don't move the centre
          const top = i.kind === 'side' ? i.r.top + i.r.height * 0.12 : i.r.top + (i.r.height - h) / 2;
          box.style.cssText = `position:fixed;top:${top}px;${side};height:${h}px;display:flex;align-items:center`;
          if (rank && i.kind === 'vr') {
            const value = parseInt(i.text, 10) || 0;
            // badge=<name>: always that badge (a rank one, or a specialty one like donor); otherwise it follows the number.
            const src = pickedBadge
              ? pickedBadge.startsWith('mkw-')
                ? base + 'mkw/' + pickedBadge.slice(4) + '.png'
                : base + (ranks.some(t => t[1] === pickedBadge) ? 'ranks/' : 'badges/') + pickedBadge + '.webp'
              : mmr ? lounge.info?.icon : base + 'ranks/' + ranks.find(t => value >= t[0])[1] + '.webp';
            if (src) {
              const badge = document.createElement('img');
              const size = h * 0.9 * badgeSize;
              const gap = fontHere ? h * badgeGap : 0;
              badge.style.cssText = `height:${size}px;width:auto;margin-right:${gap}px`;
              if (ro)
                // The outline is drawn outside the badge: the picture grows by it and negative margins keep the badge
                // itself (and the gap to the number) where it was.
                outlinedBadge(src).then(done => {
                  if (!done) {
                    badge.style.filter = outline(Math.max(0.5, h * 0.006 * rw));
                    badge.src = src;
                    return;
                  }
                  const edge = (size * (done.grow - 1)) / 2;
                  badge.style.cssText = `height:${size * done.grow}px;width:auto;margin:${-edge}px ${gap - edge}px ${-edge}px ${-edge}px`;
                  badge.src = done.url;
                });
              else badge.src = src;
              box.appendChild(badge);
            }
          }
          if (fontHere)
            for (const c of i.text) {
              if (c === ' ') {
                const gap = document.createElement('span');
                gap.style.cssText = `display:inline-block;width:${h * 0.3}px`;
                box.appendChild(gap);
                continue;
              }
              const img = document.createElement('img');
              img.style.cssText = `height:${h}px;width:auto;margin-left:${-h * 0.025}px`;
              const colour = i.col || (i.kind === 'name' ? tint.name : i.kind === 'delta' || i.kind === 'side' ? (i.text.startsWith('-') ? tint.loss : tint.gain) : vr);
              glyph(fileFor(c), colour).then(url => (img.src = url));
              box.appendChild(img);
            }
          layer.appendChild(box);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    if (mmr) setInterval(loungePlayer, 30000);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
