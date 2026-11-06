// The settings page: the same options as Wheel Wizard+'s VR overlay tab, kept in this browser, turned into the
// overlay's link (overlay/?view=overlay&...). The preview is the real overlay with that link.
(() => {
  const STORE = 'rewind-overlay-plus';
  // MMR needs no friend code, but the page only leaves its demo mode with a real-looking one (Wii friend codes carry
  // a checksum): this is the code of player id 1.
  const PLACEHOLDER_FC = '021474836481';

  // The overlay page's own defaults (only what differs travels in its cfg), plus Wheel Wizard+'s additions.
  const PAGE_DEFAULTS = {
    visibility: {
      avatar: true, name: true, tag: true, vr: true, delta: true, rank: true, rankDelta: true,
      connection: false, room: false, track: false, sessionDelta: false, dailyDelta: false,
    },
    avatar: { background: 'gradient', color1: '#31d4ff', color2: '#3556ae' },
    layout: { scale: 1, width: 560, compact: false, align: 'horizontal' },
    typography: { weight: 800, textColor: '#ffffff', mutedColor: '#c9d1e7', vrColor: '#8effc6', gainColor: '#5ef0a5', lossColor: '#ff6d7e', rankColor: '#ffe88f' },
    background: {
      imageUrl: '', fit: 'cover', x: 50, y: 50, zoom: 1, blur: 0, brightness: 0.58, saturation: 1.15, contrast: 1.08,
      overlayColor: '#07111f', overlayOpacity: 0.38, glass: 0.26,
    },
    border: { effect: 'rainbow', width: 4, radius: 38, speed: 5.5, glow: true, glowStrength: 0.65, color1: '#22d3ee', color2: '#8b5cf6', color3: '#f97316' },
    animations: { vr: 'count', rank: 'flip', durationMs: 1100, celebrateThreshold: 250, reducedMotion: false },
  };
  const PLUS_DEFAULTS = {
    preview: { gain: 41 },
    font: { text: '', number: '', customText: '', customNumber: '' },
    player: { source: 'vr', friendCode: '', tag: '', pollSeconds: 5, loungeName: '', ladder: 'rr', flag: false },
    plus: {
      rankBadge: false, rankOutline: false, rankOutlineColor: '#ffffff', rankOutlineWidth: 3, rankBadgeSize: 100, rankBadgeGap: 15,
      card: true, hudDigits: false, look: 'card', divisionBacking: false,
    },
  };
  const DEFAULTS = { ...structuredClone(PAGE_DEFAULTS), ...structuredClone(PLUS_DEFAULTS) };

  const merge = (into, from) => {
    for (const [key, value] of Object.entries(from || {}))
      if (value && typeof value === 'object' && !Array.isArray(value) && into[key] && typeof into[key] === 'object') merge(into[key], value);
      else if (key in into) into[key] = value;
    return into;
  };
  let settings = merge(structuredClone(DEFAULTS), JSON.parse(localStorage.getItem(STORE) || '{}'));
  const get = path => path.split('.').reduce((o, k) => o?.[k], settings);
  const set = (path, value) => {
    const keys = path.split('.');
    keys.slice(0, -1).reduce((o, k) => o[k], settings)[keys.at(-1)] = value;
    localStorage.setItem(STORE, JSON.stringify(settings));
    changed();
  };

  const mmr = () => settings.player.source === 'mmr';
  const unit = text => (mmr() ? text.replace(/\bVR\b/g, 'MMR') : text);
  // The race HUD look comes with the "race hud" VR change: no card, race HUD digits and font.
  const hudLook = () => settings.animations.vr === 'race hud';
  const slimLook = () => !hudLook() && settings.plus.look === 'slim';

  // ---------- the link ----------
  function diff(defaults, current) {
    const out = {};
    for (const [key, value] of Object.entries(current)) {
      if (!(key in defaults)) continue;
      if (value && typeof value === 'object') {
        const inner = diff(defaults[key], value);
        if (Object.keys(inner).length) out[key] = inner;
      } else if (value !== defaults[key]) out[key] = value;
    }
    return out;
  }

  const base64url = text => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const bare = color => (color || '').replace('#', '');

  function link() {
    const page = {};
    for (const key of Object.keys(PAGE_DEFAULTS)) page[key] = structuredClone(settings[key]);
    // Race HUD only has the VR and the rank: the rest stays off whatever the card had.
    if (hudLook())
      for (const key of ['avatar', 'name', 'tag', 'rankDelta', 'connection', 'room', 'track', 'sessionDelta', 'dailyDelta']) page.visibility[key] = false;
    const patch = diff(PAGE_DEFAULTS, structuredClone(page));
    // Colours Wheel Wizard+ adds itself (the page has them fixed).
    if (patch.typography) for (const key of ['vrColor', 'gainColor', 'lossColor', 'rankColor']) delete patch.typography[key];
    if (patch.typography && !Object.keys(patch.typography).length) delete patch.typography;
    // "race hud" is Wheel Wizard+'s own VR change: the page counts, the script draws the countdown.
    if (hudLook() && patch.animations) patch.animations.vr = 'count';
    if (mmr()) patch.data = { leaderboardUrl: './ww-mmr/player/{friendCode}', groupsUrl: './ww-mmr/rooms' };

    const digits = settings.player.friendCode.replace(/\D/g, '');
    const params = new URLSearchParams({ view: 'overlay', fc: mmr() ? PLACEHOLDER_FC : digits });
    const t = settings.typography;
    const colors = [t.vrColor, t.gainColor, t.lossColor, t.rankColor].map(bare).join('-');
    if (colors !== '8effc6-5ef0a5-ff6d7e-ffe88f') params.set('colors', colors);
    if (settings.player.tag && !hudLook()) params.set('tag', settings.player.tag);
    if (!mmr() && settings.player.pollSeconds !== 5) params.set('poll', settings.player.pollSeconds);
    if (Object.keys(patch).length) params.set('cfg', base64url(JSON.stringify(patch)));
    if (mmr()) {
      params.set('src', 'mmr');
      params.set('ln', settings.player.loungeName);
      params.set('ladder', settings.player.ladder);
      if (settings.player.flag && !hudLook()) params.set('flag', 'on');
    }
    const p = settings.plus;
    if (!hudLook()) {
      const f = settings.font;
      const pickFont = (value, custom) => (value === 'custom' ? custom.trim() : value);
      const text = pickFont(f.text, f.customText);
      const number = pickFont(f.number, f.customNumber);
      if (text) params.set('font', text);
      if (number) params.set('nfont', number);
    }
    if (slimLook()) params.set('look', 'slim');
    if (slimLook() && mmr() && settings.plus.divisionBacking) params.set('db', 'on');
    if (hudLook() || !p.card) params.set('card', 'off');
    if (hudLook() || p.hudDigits) params.set('digits', 'hud');
    if (hudLook()) {
      params.set('text', 'hud');
      params.set('vrhud', '1');
    }
    if (p.rankBadge) {
      params.set('rank', 'on');
      params.set('bs', p.rankBadgeSize);
      params.set('bg', p.rankBadgeGap);
      if (p.rankOutline) {
        params.set('ro', bare(p.rankOutlineColor));
        params.set('rw', p.rankOutlineWidth);
      }
    }
    params.set('tc', bare(t.textColor));
    params.set('mc', bare(t.mutedColor));
    return new URL('overlay/index.html?' + params, location.href).href;
  }

  const valid = () => (mmr() ? settings.player.loungeName.trim().length > 0 : settings.player.friendCode.replace(/\D/g, '').length === 12);

  // ---------- the controls ----------
  const options = document.getElementById('rows');
  const syncs = [];
  const rows = [];

  function row(label, hint, control, when) {
    const el = document.createElement('div');
    el.className = 'row';
    el.innerHTML = `<div class="label"><strong></strong>${hint ? '<small></small>' : ''}</div>`;
    el.querySelector('strong').textContent = label;
    el.dataset.label = label;
    if (hint) el.querySelector('small').textContent = hint;
    el.append(control);
    rows.push({ el, when });
    return el;
  }

  // One section shows at a time; the sidebar picks it.
  const nav = document.getElementById('nav');
  const sections = [];
  let current = null;

  function section(title, items, when) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = title;
    const s = { title, items, when, button };
    button.addEventListener('click', () => show(s));
    nav.append(button);
    sections.push(s);
    return s;
  }

  let playTimer = 0;
  const playOnce = () =>
    document.getElementById('preview').contentWindow?.postMessage({ ww: 'play-gain', gain: settings.preview.gain, ms: settings.animations.durationMs }, '*');

  function show(s) {
    current = s;
    clearInterval(playTimer);
    if (s === previewTab || s === animationTab) {
      playOnce();
      playTimer = setInterval(playOnce, hudLook() ? 4000 : Math.max(4000, settings.animations.durationMs + 2800));
    }
    for (const other of sections) other.button.setAttribute('aria-current', String(other === s));
    options.replaceChildren(...s.items);
    markFirst();
    const panel = document.getElementById('panel');
    panel.classList.remove('enter');
    void panel.offsetWidth;
    panel.classList.add('enter');
  }

  const markFirst = () => {
    let first = true;
    for (const el of options.children) {
      el.classList.toggle('first', first && !el.hidden);
      if (!el.hidden) first = false;
    }
  };

  function toggle(path) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'switch';
    syncs.push(() => (input.checked = !!get(path)));
    input.addEventListener('change', () => set(path, input.checked));
    return input;
  }

  const units = u => unit(u);
  function slider(path, min, max, step, unit) {
    const wrap = document.createElement('div');
    wrap.className = 'slider';
    wrap.innerHTML = '<input type="range"><output></output>';
    const input = wrap.querySelector('input');
    const output = wrap.querySelector('output');
    Object.assign(input, { min, max, step });
    syncs.push(() => {
      input.value = get(path);
      output.textContent = get(path) + units(unit);
    });
    input.addEventListener('input', () => {
      output.textContent = input.value + units(unit);
      set(path, Number(input.value));
    });
    return wrap;
  }

  function color(path) {
    const wrap = document.createElement('div');
    wrap.className = 'color';
    wrap.innerHTML = '<input type="color"><input type="text" placeholder="#rrggbb">';
    const [picker, text] = wrap.querySelectorAll('input');
    syncs.push(() => {
      picker.value = get(path);
      text.value = get(path);
    });
    picker.addEventListener('input', () => {
      text.value = picker.value;
      set(path, picker.value);
    });
    text.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(text.value)) {
        picker.value = text.value;
        set(path, text.value);
      }
    });
    return wrap;
  }

  // Card or Race HUD. The race HUD look is the "race hud" VR change, so this just switches that.
  function style() {
    const wrap = document.createElement('div');
    wrap.className = 'styles';
    wrap.setAttribute('role', 'radiogroup');
    wrap.setAttribute('aria-label', 'Style');
    // A small drawing of each look: a mini card, or the number in the game's own digits.
    const card = '<span class="mini-card"><i></i><span><b></b><b></b></span><em>9,044</em></span>';
    const hud = '<span class="mini-hud">' + [...'9044'].map(d => `<img src="overlay/font/${d}.png" alt="">`).join('') + '</span>';
    const slim = '<span class="mini-slim"><span><i></i><b></b></span><em>3945</em></span>';
    const pick = (value, title, sub) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.innerHTML = `<span class="look">${value === 'hud' ? hud : value === 'slim' ? slim : card}</span><strong></strong><small></small>`;
      b.querySelector('strong').textContent = title;
      b.querySelector('small').textContent = sub;
      b.addEventListener('click', () => {
        // Card and Slim each start from their own look; the options can change it after.
        if (value === 'card') {
          Object.assign(settings.plus, { card: true, hudDigits: false, look: 'card' });
          Object.assign(settings.visibility, { avatar: true, name: true, rank: true });
          settings.border = structuredClone(PAGE_DEFAULTS.border);
          settings.layout = structuredClone(PAGE_DEFAULTS.layout);
        }
        if (value === 'slim') {
          Object.assign(settings.plus, { card: true, hudDigits: false, look: 'slim' });
          Object.assign(settings.visibility, { avatar: false, name: true, rank: false, delta: true });
          Object.assign(settings.border, { effect: 'solid', width: 3, radius: 60, glow: false, color1: '#e8a6b8' });
          Object.assign(settings.layout, { compact: true, width: 470 });
          Object.assign(settings.background, { overlayOpacity: 0.3, brightness: 0.75, blur: 0 });
        }
        set('animations.vr', value === 'hud' ? 'race hud' : 'count');
        for (const sync of syncs) sync();
      });
      syncs.push(() => b.setAttribute('aria-checked', String(value === (hudLook() ? 'hud' : slimLook() ? 'slim' : 'card'))));
      return b;
    };
    wrap.append(pick('card', 'Card', 'Border, background, Mii'), pick('slim', 'Slim', 'Thin pill, flag, division'), pick('hud', 'Race HUD', 'Game font, no card'));
    rows.push({ el: wrap });
    return wrap;
  }

  function choice(path, values) {
    const select = document.createElement('select');
    // A value, or [value, label].
    for (const v of values) select.append(Array.isArray(v) ? new Option(v[1], v[0]) : new Option(v, v));
    syncs.push(() => (select.value = get(path)));
    select.addEventListener('change', () => {
      set(path, select.value);
      for (const sync of syncs) sync();
    });
    return select;
  }

  function text(path, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder || '';
    syncs.push(() => (input.value = get(path)));
    input.addEventListener('input', () => set(path, input.value));
    return input;
  }

  const vrOnly = () => !mmr();
  const mmrOnly = () => mmr();
  const badgeOnly = () => !hudLook();
  // Rooms, connection and VR history only exist for VR (rwfc.net), not on the RR Lounge.
  const cardVr = () => !hudLook() && !mmr();
  const badge = () => settings.plus.rankBadge;
  const outlined = () => settings.plus.rankBadge && settings.plus.rankOutline;

  section('Player', [
    style(),
    row('Show', null, choice('player.source', [['vr', 'VR'], ['mmr', 'MMR']])),
    row('Friend code', null, text('player.friendCode', '0000-0000-0000'), vrOnly),
    row('Update every', null, slider('player.pollSeconds', 3, 60, 1, ' s'), vrOnly),
    row('RR Lounge name', null, text('player.loungeName', 'Your RR Lounge name'), mmrOnly),
    row('Leaderboard', null, choice('player.ladder', [['rr', 'Retro Rewind'], ['ct', 'Custom Tracks'], ['tt', 'Time Trial']]), mmrOnly),
    row('Tag', null, text('player.tag', ''), badgeOnly),
  ]);

  section('Show', [
    row('Mii picture', null, toggle('visibility.avatar'), badgeOnly),
    row('Name', null, toggle('visibility.name'), badgeOnly),
    row('Country flag', null, toggle('player.flag'), () => mmr() && !hudLook()),
    row('Tag', null, toggle('visibility.tag'), badgeOnly),
    row('VR', null, toggle('visibility.vr')),
    row('VR change', null, toggle('visibility.delta'), badgeOnly),
    row('Rank', null, toggle('visibility.rank')),
    row('Rank change', null, toggle('visibility.rankDelta'), cardVr),
    row('Connection', null, toggle('visibility.connection'), cardVr),
    row('Room', null, toggle('visibility.room'), cardVr),
    row('Track', null, toggle('visibility.track'), cardVr),
    row('Session VR', null, toggle('visibility.sessionDelta'), badgeOnly),
    row('24 hour VR', null, toggle('visibility.dailyDelta'), cardVr),
    row('Division backing', 'Black box behind the division name', toggle('plus.divisionBacking'), () => slimLook() && mmr()),
    row('Rank badge', null, toggle('plus.rankBadge')),
    row('Rank badge outline', null, toggle('plus.rankOutline'), badge),
    row('Outline strength', null, slider('plus.rankOutlineWidth', 1, 10, 1, ''), outlined),
    row('Rank badge size', null, slider('plus.rankBadgeSize', 30, 300, 5, ' %'), badge),
    row('Rank badge spacing', null, slider('plus.rankBadgeGap', 0, 100, 1, ' %'), badge),
  ]);

  section('Size', [
    row('Width', null, slider('layout.width', 320, 900, 10, ' px'), badgeOnly),
    row('Compact', null, toggle('layout.compact'), badgeOnly),
    row('Card', null, toggle('plus.card'), badgeOnly),
    row('Text weight', null, slider('typography.weight', 400, 900, 100, '')),
  ], badgeOnly);

  const FONTS = [
    ['', 'Default'], ['Inter', 'Inter'], ['Poppins', 'Poppins'], ['Montserrat', 'Montserrat'], ['Rubik', 'Rubik'],
    ['Outfit', 'Outfit'], ['Oswald', 'Oswald'], ['Bebas Neue', 'Bebas Neue'], ['Anton', 'Anton'], ['Russo One', 'Russo One'],
    ['Orbitron', 'Orbitron'], ['Audiowide', 'Audiowide'], ['Bungee', 'Bungee'], ['Press Start 2P', 'Press Start 2P'],
    ['Fredoka', 'Fredoka'], ['Lilita One', 'Lilita One'], ['custom', 'Other (Google Fonts)…'],
  ];
  section('Font', [
    row('Text font', 'Name and labels', choice('font.text', FONTS)),
    row('Font name', 'Any font on fonts.google.com', text('font.customText', 'e.g. Exo 2'), () => settings.font.text === 'custom'),
    row('Number font', null, choice('font.number', FONTS)),
    row('Font name', 'Any font on fonts.google.com', text('font.customNumber', 'e.g. Teko'), () => settings.font.number === 'custom'),
  ], badgeOnly);

  section('Border', [
    row('Effect', null, choice('border.effect', ['rainbow', 'snake', 'pulse', 'wave', 'ghost', 'solid', 'off'])),
    row('Thickness', null, slider('border.width', 0, 16, 1, ' px')),
    row('Roundness', null, slider('border.radius', 0, 60, 1, ' px')),
    row('Speed', null, slider('border.speed', 1, 20, 0.5, ' s')),
    row('Glow', null, toggle('border.glow')),
    row('Glow strength', null, slider('border.glowStrength', 0, 1, 0.05, '')),
    row('Color 1', null, color('border.color1')),
    row('Color 2', null, color('border.color2')),
    row('Color 3', null, color('border.color3')),
  ], badgeOnly);

  section('Colors', [
    row('Text', null, color('typography.textColor')),
    row('Secondary text', null, color('typography.mutedColor'), badgeOnly),
    row('VR number', null, color('typography.vrColor')),
    row('Race HUD digits', null, toggle('plus.hudDigits'), badgeOnly),
    row('Gains', null, color('typography.gainColor')),
    row('Losses', null, color('typography.lossColor')),
    row('Rank', null, color('typography.rankColor'), badgeOnly),
    row('Rank badge outline', null, color('plus.rankOutlineColor'), outlined),
    row('Mii backing', null, choice('avatar.background', ['gradient', 'solid', 'transparent']), badgeOnly),
    row('Mii color 1', null, color('avatar.color1'), badgeOnly),
    row('Mii color 2', null, color('avatar.color2'), badgeOnly),
  ]);

  section('Background', [
    row('Picture link', null, text('background.imageUrl', 'https://…')),
    row('Fit', null, choice('background.fit', ['cover', 'contain', 'stretch'])),
    row('Zoom', null, slider('background.zoom', 1, 4, 0.05, 'x')),
    row('Position left/right', null, slider('background.x', 0, 100, 1, ' %')),
    row('Position up/down', null, slider('background.y', 0, 100, 1, ' %')),
    row('Tint color', null, color('background.overlayColor')),
    row('Tint strength', null, slider('background.overlayOpacity', 0, 1, 0.02, '')),
    row('Brightness', null, slider('background.brightness', 0, 2, 0.02, '')),
    row('Contrast', null, slider('background.contrast', 0, 2, 0.02, '')),
    row('Saturation', null, slider('background.saturation', 0, 2, 0.02, '')),
    row('Blur', null, slider('background.blur', 0, 30, 1, ' px')),
    row('Glass', null, slider('background.glass', 0, 1, 0.02, '')),
  ], badgeOnly);

  // Preview: while this tab is open the overlay acts out a race result every few seconds.
  const previewTab = section('Preview', [
    row('Change', 'Plays over and over while this tab is open.', slider('preview.gain', -100, 200, 1, ' VR')),
  ], hudLook);

  const animationTab = section('Animation', [
    row('Preview change', 'Plays over and over while this tab is open.', slider('preview.gain', -100, 200, 1, ' VR')),
    row('VR change', null, choice('animations.vr', ['count', 'spring', 'flip', 'burst', 'none'])),
    row('Rank change', null, choice('animations.rank', ['flip', 'count', 'spring', 'burst', 'none'])),
    row('Length', null, slider('animations.durationMs', 200, 3000, 50, ' ms')),
    row('Big gain bursts at', null, slider('animations.celebrateThreshold', 50, 1000, 10, ' VR')),
    row('Reduce motion', null, toggle('animations.reducedMotion')),
  ], badgeOnly);

  // ---------- keeping it all in step ----------
  const preview = document.getElementById('preview');
  const note = document.getElementById('note');
  const empty = document.getElementById('empty');
  const open = document.getElementById('open');
  let previewTimer = 0;
  const fromFile = location.protocol === 'file:';

  // The overlay lays out at least FRAME px wide, then is scaled down to the stage, so the card always fits.
  const FRAME = 760;
  new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const scale = Math.min(1, width / FRAME);
    preview.style.width = width / scale + 'px';
    preview.style.height = height / scale + 'px';
    preview.style.transform = `scale(${scale})`;
  }).observe(preview.parentElement);

  const missing = () => (mmr() ? 'Enter your RR Lounge name' : 'Enter your friend code');


  function changed() {
    for (const { el, when } of rows) el.hidden = when ? !when() : false;
    // With MMR picked, the labels say MMR.
    for (const { el } of rows) if (el.dataset.label) el.querySelector('strong').textContent = unit(el.dataset.label);
    for (const s of sections) s.button.hidden = s.when ? !s.when() : false;
    if (current?.button.hidden) show(sections[0]);
    markFirst();
    const ok = valid();
    note.textContent = '';
    empty.textContent = fromFile ? 'The preview needs the site served over http, not opened as a file.' : ok ? '' : missing();
    open.setAttribute('aria-disabled', String(!ok));
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const url = ok && !fromFile ? link() : 'about:blank';
      open.href = ok ? url : '#';
      if (preview.src !== url) preview.src = url;
    }, 400);
  }


  document.getElementById('reset').addEventListener('click', () => {
    const player = settings.player;
    settings = structuredClone(DEFAULTS);
    settings.player = player;
    localStorage.setItem(STORE, JSON.stringify(settings));
    for (const sync of syncs) sync();
    changed();
  });

  const copy = document.getElementById('copy');
  copy.addEventListener('click', async () => {
    if (!valid()) {
      show(sections[0]);
      note.textContent = missing();
      return;
    }
    try {
      await navigator.clipboard.writeText(link());
      note.textContent = 'Paste it into an OBS Browser source (1920 × 1080).';
      copy.textContent = 'Copied';
      clearTimeout(copy.timer);
      copy.timer = setTimeout(() => (copy.textContent = 'Copy link'), 1600);
    } catch {
      window.prompt('Copy this link:', link());
    }
  });

  for (const sync of syncs) sync();
  show(sections[0]);
  changed();
})();
