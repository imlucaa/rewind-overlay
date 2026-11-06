// rewind-overlay-plus: what Wheel Wizard+ adds to the Rewind VR overlay, done in the browser.
// The overlay page itself is MichaelAccount1's Rewind Overlay (MIT, see LICENSE-rewind-overlay.txt). This script runs
// before it and adds, from the link's settings:
//   colours (colors=vr-gain-loss-rank), no card (card=off), race HUD digits (digits=hud), the race HUD font for the
//   name and the rest (text=hud), the race HUD VR change (vrhud=1), the rank badge (rank=on, bs, bg, ro, rw),
//   and the RR Lounge MMR in place of the VR (src=mmr, ln=<lounge name>, ladder=rr|ct|tt, flag=on).
(() => {
  const q = new URLSearchParams(location.search);
  const base = new URL('.', document.currentScript.src).href;
  const hex = value => (/^[0-9a-fA-F]{6}$/.test(value || '') ? '#' + value : null);
  const mmr = q.get('src') === 'mmr';
  const ladder = ['rr', 'ct', 'tt'].includes(q.get('ladder')) ? q.get('ladder') : 'rr';
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
      const root = document.getElementById('root') || document.body;
      root.style.transition = 'opacity .2s';
      root.style.opacity = '0';
      setTimeout(() => {
        ctl.engine.player = saved;
        ctl.emitChange();
        setTimeout(() => {
          root.style.opacity = '';
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

  async function readLounge() {
    try {
      const board = await (await realFetch(`https://rr-lounge.com/api/leaderboard?category=${ladder}`, { cache: 'no-store' })).json();
      const found = (board.players || []).find(p => p.name.toLowerCase() === loungeName.toLowerCase());
      if (found) {
        const data = await loungeExtras();
        const tiers = (data?.tiers || []).slice().sort((a, b) => b.minMmr - a.minMmr);
        const tier = tiers.find(t => found.mmr >= t.minMmr) || null;
        lounge.player = found;
        lounge.info = {
          country: data?.countries?.[found.id] || null,
          icon: tier?.icon ? 'https://rr-lounge.com' + tier.icon : null,
          division: tier?.name || null,
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
          style.textContent += `.player-name{padding-left:1.55em;background:url(https://flagcdn.com/w80/${country.toLowerCase()}.png) left center/1.3em .95em no-repeat}`;
      });
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
  page.src = base + 'assets/' + (mmr ? 'mmr-' : '') + 'index-CPppRstO.js?v=16';
  document.head.appendChild(page);

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
  const badgeSize = Math.min(300, Math.max(30, parseFloat(q.get('bs')) || 100)) / 100;
  const badgeGap = Math.min(100, Math.max(0, parseFloat(q.get('bg') ?? '15'))) / 100;
  const ro = hex(q.get('ro'));
  const rw = Math.min(10, Math.max(1, parseFloat(q.get('rw')) || 3));
  const outline = h =>
    ro
      ? [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]
          .map(([x, y]) => `drop-shadow(${x * h}px ${y * h}px 0 ${ro})`)
          .join(' ')
      : 'none';
  const ranks = [[100000, 'crown'], [94000, '3star'], [84000, '2star'], [72000, 'star'], [60000, 'a'], [48000, 'b'], [36000, 'c'], [24000, 'd'], [0, 'e']];
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
        if (left !== 0 && Math.sign(left) === Math.sign(mmrChange.delta) && Math.abs(left) <= Math.abs(mmrChange.delta))
          list.push({ el: vrEl, kind: 'side', text: (left > 0 ? '+' : '') + left });
        else if (vrNow === mmrChange.from + mmrChange.delta) mmrChange = null;
      }
      // Play gain: the change shows for a second, then counts into the number like in the game.
      if (raceCount && play && vrEl) {
        const t = (performance.now() - play.at) / 1000;
        const q = Math.min(1, Math.max(0, (t - 1) / 1.2));
        const added = Math.round(play.gain * q);
        if (t > 2.6) play = null;
        else {
          for (let i = list.length - 1; i >= 0; i--) if (list[i].kind === 'delta') list.splice(i, 1);
          const vr = list.find(i => i.kind === 'vr');
          if (vr) vr.text = String(vrNow - play.gain + added);
          const left = play.gain - added;
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
          if (i.kind === 'side') box.dataset.side = '1'; // the change comes and goes: it doesn't move the centre
          const top = i.kind === 'side' ? i.r.top + i.r.height * 0.12 : i.r.top + (i.r.height - h) / 2;
          box.style.cssText = `position:fixed;top:${top}px;${side};height:${h}px;display:flex;align-items:center`;
          if (rank && i.kind === 'vr') {
            const value = parseInt(i.text, 10) || 0;
            const src = mmr ? lounge.info?.icon : base + 'ranks/' + ranks.find(t => value >= t[0])[1] + '.webp';
            if (src) {
              const badge = document.createElement('img');
              badge.src = src;
              badge.style.cssText = `height:${h * 0.9 * badgeSize}px;width:auto;margin-right:${fontHere ? h * badgeGap : 0}px;filter:${outline(Math.max(1, h * 0.015 * rw))}`;
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
