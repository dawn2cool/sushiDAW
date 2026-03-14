/*
  app.js — SushiDAW
  Dynamic channels, ingredient shelf, pattern engine, UI.
*/

/* ════════════════════════════════════════
   INGREDIENT DEFINITIONS
   (the palette — instances are created from these)
   ════════════════════════════════════════ */
const INGREDIENT_DEFS = [
  { name:'cream cheese', color:'#C8A840', defCount: 1 },
  { name:'salmon', color:'#E85038', defCount: 1 },
  { name:'tuna', color:'#B01828', defCount: 1 },
  { name:'avocado', color:'#3A8030', defCount: 1 },
  { name:'cucumber', color:'#1A9058', defCount: 1 },
  { name:'egg', color:'#D09010', defCount: 1 },
  { name:'prawn', color:'#C84028', defCount: 1 },
  { name:'wasabi', color:'#1A5030', defCount: 1 },
];

/*
  channelInstances: the live array of rows.
  Each entry: { def, instanceNum, id }
  Starts with one of each, in order.
  Users can add more via the shelf (e.g. 3 × salmon).
*/
let channelInstances = INGREDIENT_DEFS.map((def, i) => ({
  def,
  instanceNum: 1,
  id: i,          // stable unique id
}));
let nextId = INGREDIENT_DEFS.length;

/* Count how many instances exist per ingredient name */
function countInstances(name) {
  return channelInstances.filter(c => c.def.name === name).length;
}

/* ════════════════════════════════════════
   SEQUENCER STATE
   ════════════════════════════════════════ */
let numSteps  = 16;
let bpm       = 128;
let playing   = false;
let curStep   = -1;
let uiStep    = -1;
let schedTimer = null;
let nextTime  = 0;
let activePat = 0;

/*
  patterns[4][MAX_ROWS][32]
  We keep a generous MAX_ROWS; only channelInstances.length rows are active.
*/
const MAX_ROWS = 300;
const patterns = Array(4).fill(null).map(() =>
  Array(MAX_ROWS).fill(null).map(() => Array(300).fill(false))
);
const volumes  = Array(MAX_ROWS).fill(0.75);
const muted    = Array(MAX_ROWS).fill(false);

const getGrid = () => patterns[activePat];

/* ════════════════════════════════════════
   CELL WIDTH
   ════════════════════════════════════════ */
function cellW() {
  const scroll = document.getElementById('rack-scroll');
  const lw     = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--label-w') || '148');
  const avail  = (scroll?.clientWidth || 600) - lw - 24;
  const gaps   = (numSteps - 1) * 3 + (Math.floor(numSteps / 4) - 1) * 6;
  return Math.max(16, Math.min(28, Math.floor((avail - gaps) / numSteps)));
}

/* ════════════════════════════════════════
   RENDER STEP HEADER
   ════════════════════════════════════════ */
function renderHeader() {
  const el = document.getElementById('step-header');
  const cw = cellW();
  el.innerHTML = '';
  for (let g = 0; g < numSteps / 4; g++) {
    const grp = document.createElement('div');
    grp.className = 'step-grp-h';
    if (g > 0) grp.style.marginLeft = '6px';
    for (let s = 0; s < 4; s++) {
      const n = document.createElement('div');
      n.className = 'step-num' + (s === 0 ? ' beat' : '');
      n.style.width = cw + 'px';
      n.textContent = g * 4 + s + 1;
      grp.appendChild(n);
    }
    el.appendChild(grp);
  }
}

/* ════════════════════════════════════════
   RENDER RACK
   ════════════════════════════════════════ */
function renderRack() {
  const rack   = document.getElementById('rack');
  rack.innerHTML = '';
  const grid   = getGrid();
  const cw     = cellW();
  const ghosts = GeminiSuggest.getSuggestions();

  channelInstances.forEach((inst, r) => {
    const ch  = inst.def;
    const row = document.createElement('div');
    row.className = 'channel-row';
    row.style.animationDelay = (r * 0.03) + 's';

    /* ── Label ── */
    const lbl = document.createElement('div');
    lbl.className = 'ch-label';

    const dot = document.createElement('div');
    dot.className = 'ch-dot';
    dot.style.background = ch.color;

    const name = document.createElement('span');
    name.className = 'ch-name';
    name.textContent = ch.name;

    // Instance badge if there are multiple of the same ingredient
    if (countInstances(ch.name) > 1) {
      const badge = document.createElement('span');
      badge.className = 'ch-instance-badge';
      badge.textContent = '#' + inst.instanceNum;
      lbl.append(dot, name, badge);
    } else {
      lbl.append(dot, name);
    }

    const muteBtn = document.createElement('button');
    muteBtn.className = 'mute-btn' + (muted[r] ? ' muted' : '');
    muteBtn.textContent = 'M';
    muteBtn.onclick = () => { muted[r] = !muted[r]; muteBtn.classList.toggle('muted', muted[r]); };

    // Remove button (only show if this is a duplicate ingredient)
    if (countInstances(ch.name) > 1) {
      const rmBtn = document.createElement('button');
      rmBtn.className = 'remove-btn';
      rmBtn.textContent = '×';
      rmBtn.title = 'remove this layer';
      rmBtn.onclick = () => removeChannelInstance(r);
      lbl.append(muteBtn, buildVolume(r, ch), rmBtn);
    } else {
      lbl.append(muteBtn, buildVolume(r, ch));
    }

    row.appendChild(lbl);

    /* ── Steps ── */
    const stepsEl = document.createElement('div');
    stepsEl.className = 'ch-steps';

    for (let g = 0; g < numSteps / 4; g++) {
      const grp = document.createElement('div');
      grp.className = 'step-grp';
      if (g > 0) grp.style.marginLeft = '6px';

      for (let s = 0; s < 4; s++) {
        const idx     = g * 4 + s;
        const isOn    = grid[r][idx];
        const isGhost = !isOn && ghosts.some(gs => gs.row === r && gs.step === idx);

        const cell = document.createElement('div');
        cell.className = 'cell' + (isOn ? ' on' : '') + (isGhost ? ' ghost' : '');
        cell.style.width  = cw + 'px';
        cell.dataset.ch   = r;
        cell.dataset.s    = idx;

        if (isOn && uiStep === idx && playing) cell.classList.add('playing');
        cell.onclick = () => handleCellClick(r, idx, ch, cell);
        grp.appendChild(cell);
      }
      stepsEl.appendChild(grp);
    }

    row.appendChild(stepsEl);
    rack.appendChild(row);
  });

  renderHeader();
  updateStatus();
}

/* ════════════════════════════════════════
   CELL CLICK
   ════════════════════════════════════════ */
function handleCellClick(r, idx, ch, cell) {
  const grid    = getGrid();
  const isGhost = cell.classList.contains('ghost');

  if (isGhost) {
    grid[r][idx] = true;
    GeminiSuggest.acceptSuggestion(r, idx);
    renderRack();
    Audio.init(); Audio.resume();
    Audio.playNote(r % INGREDIENT_DEFS.length, Audio.currentTime(), volumes[r]);
    return;
  }

  grid[r][idx] = !grid[r][idx];
  if (grid[r][idx]) {
    cell.classList.add('on', 'bounce');
    setTimeout(() => cell.classList.remove('bounce'), 150);
    Audio.init(); Audio.resume();
    Audio.playNote(r % INGREDIENT_DEFS.length, Audio.currentTime(), volumes[r]);
  } else {
    cell.classList.remove('on');
  }

  GeminiSuggest.clearSuggestions();
  GeminiSuggest.notify(grid, numSteps);
  updateStatus();
}

/* ════════════════════════════════════════
   VOLUME WIDGET
   ════════════════════════════════════════ */
function buildVolume(r, ch) {
  const wrap  = document.createElement('div');
  wrap.className = 'vol-wrap';
  const track = document.createElement('div');
  track.className = 'vol-track';
  const fill  = document.createElement('div');
  fill.className = 'vol-fill';
  fill.style.cssText = `width:${volumes[r]*100}%;background:${ch.color};`;
  const thumb = document.createElement('div');
  thumb.className = 'vol-thumb';
  thumb.style.cssText = `left:${volumes[r]*100}%;border-color:${ch.color}55;`;
  track.append(fill, thumb);
  wrap.appendChild(track);

  let drag = false;
  const upd = e => {
    const rect = track.getBoundingClientRect();
    const x    = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    const p    = Math.max(0, Math.min(1, x / rect.width));
    volumes[r] = p;
    fill.style.width = (p*100)+'%';
    thumb.style.left = (p*100)+'%';
  };
  thumb.addEventListener('mousedown', e => { e.stopPropagation(); drag = true; });
  track.addEventListener('mousedown', e => { drag = true; upd(e); });
  window.addEventListener('mousemove', e => { if (drag) upd(e); });
  window.addEventListener('mouseup',   () => { drag = false; });
  return wrap;
}

/* ════════════════════════════════════════
   ADD / REMOVE CHANNEL INSTANCES
   ════════════════════════════════════════ */
function addChannelInstance(def) {
  const existingCount = countInstances(def.name);
  const maxLayers = 5;
  if (existingCount >= maxLayers) {
    // Flash the shelf pill to indicate max reached
    const pills = document.querySelectorAll('.shelf-pill');
    pills.forEach(p => {
      if (p.dataset.name === def.name) {
        p.style.animation = 'none';
        p.offsetHeight;
        p.style.borderColor = 'rgba(200,74,32,0.8)';
        setTimeout(() => p.style.borderColor = '', 600);
      }
    });
    return;
  }

  const newInst = {
    def,
    instanceNum: existingCount + 1,
    id: nextId++,
  };

  // Insert after the last instance of this ingredient type
  let insertIdx = channelInstances.length;
  for (let i = channelInstances.length - 1; i >= 0; i--) {
    if (channelInstances[i].def.name === def.name) {
      insertIdx = i + 1;
      break;
    }
  }

  channelInstances.splice(insertIdx, 0, newInst);

  // Shift pattern rows down to make room
  for (let p = 0; p < 4; p++) {
    patterns[p].splice(insertIdx, 0, Array(300).fill(false));
    if (patterns[p].length > MAX_ROWS) patterns[p].pop();
  }
  volumes.splice(insertIdx, 0, 0.75);
  muted.splice(insertIdx, 0, false);

  updateShelfCounts();
  renderRack();
}

function removeChannelInstance(rowIdx) {
  if (channelInstances.length <= 1) return; // keep at least 1 row
  const inst = channelInstances[rowIdx];
  if (!inst) return;

  // Recalculate instance numbers for remaining instances of same ingredient
  channelInstances.splice(rowIdx, 1);
  let num = 1;
  channelInstances.forEach(c => {
    if (c.def.name === inst.def.name) c.instanceNum = num++;
  });

  for (let p = 0; p < 4; p++) {
    patterns[p].splice(rowIdx, 1);
    patterns[p].push(Array(300).fill(false)); // keep array length
  }
  volumes.splice(rowIdx, 1); volumes.push(0.75);
  muted.splice(rowIdx, 1);   muted.push(false);

  updateShelfCounts();
  renderRack();
}

/* ════════════════════════════════════════
   INGREDIENT SHELF
   ════════════════════════════════════════ */
function renderShelf() {
  const container = document.getElementById('shelf-pills');
  container.innerHTML = '';

  INGREDIENT_DEFS.forEach(def => {
    const pill = document.createElement('div');
    pill.className = 'shelf-pill';
    pill.dataset.name = def.name;
    pill.title = `Add a layer of ${def.name}`;

    const nameEl = document.createElement('span');
    nameEl.className = 'shelf-pill-name';
    nameEl.textContent = def.name;

    const addEl = document.createElement('span');
    addEl.className = 'shelf-pill-add';
    addEl.textContent = '+';

    const countEl = document.createElement('span');
    countEl.className = 'shelf-pill-count';
    countEl.id = `pill-count-${def.name.replace(/\s/g,'_')}`;
    const n = countInstances(def.name);
    countEl.textContent = n;
    if (n > 1) countEl.classList.add('visible');

    pill.append(nameEl, addEl, countEl);

    /* Animated click ripple */
    pill.onclick = () => {
      const ripple = document.createElement('div');
      ripple.className = 'add-ripple';
      pill.appendChild(ripple);
      setTimeout(() => ripple.remove(), 450);
      addChannelInstance(def);
    };

    // Color tint per ingredient
    pill.style.borderColor = def.color + '60';
    container.appendChild(pill);
  });
}

function updateShelfCounts() {
  INGREDIENT_DEFS.forEach(def => {
    const el = document.getElementById(`pill-count-${def.name.replace(/\s/g,'_')}`);
    if (!el) return;
    const n = countInstances(def.name);
    el.textContent = n;
    el.classList.toggle('visible', n > 1);
  });
}

/* ════════════════════════════════════════
   SEQUENCER
   ════════════════════════════════════════ */
function schedule() {
  if (!playing) return;
  const ahead = 0.1;
  const dur   = 60 / bpm / 4;
  const grid  = getGrid();

  while (nextTime < Audio.currentTime() + ahead) {
    patterns.forEach((grid) => {
          channelInstances.forEach((inst, r) => {
            if (grid[r][curStep] && !muted[r]) {
              const voiceToPlay = inst.def.voiceIdx !== undefined ?
                                  inst.def.voiceIdx :
                                  (r % INGREDIENT_DEFS.length);
              Audio.playNote(voiceToPlay, nextTime, volumes[r]);
            }
          });
    });
    animateStep(curStep);
    nextTime += dur;
  }
  schedTimer = setTimeout(schedule, 25);
}

function animateStep(s) {
  requestAnimationFrame(() => {
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('playing','playing-off'));
    document.querySelectorAll(`.cell[data-s="${s}"]`).forEach(c => {
      c.classList.add(c.classList.contains('on') ? 'playing' : 'playing-off');
    });
    // Tick the step number header
    const stepNums = document.querySelectorAll('.step-num');
    stepNums.forEach((el, i) => {
      if (parseInt(el.textContent) - 1 === s) {
        el.classList.add('ticking');
        setTimeout(() => el.classList.remove('ticking'), 120);
      }
    });
    document.getElementById('r-step').textContent = s + 1;
    document.getElementById('r-bar').textContent  = Math.floor(s / 4) + 1;
    uiStep = s;
  });
}

/* ════════════════════════════════════════
   TRANSPORT
   ════════════════════════════════════════ */
const App = {
  togglePlay() {
    Audio.init(); Audio.resume();
    playing = !playing;
    const btn = document.getElementById('btn-play');
    if (playing) {
      curStep  = -1;
      nextTime = Audio.currentTime();
      btn.textContent = '⏸';
      btn.classList.add('playing');
      schedule();
    } else {
      clearTimeout(schedTimer);
      btn.textContent = '▶';
      btn.classList.remove('playing');
    }
  },

  stop() {
    playing = false;
    clearTimeout(schedTimer);
    curStep = -1;
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('playing','playing-off'));
    const btn = document.getElementById('btn-play');
    btn.textContent = '▶';
    btn.classList.remove('playing');
    document.getElementById('r-step').textContent = '—';
    document.getElementById('r-bar').textContent  = '—';
  },

  nudgeBpm(d) {
    bpm = Math.max(40, Math.min(300, bpm + d));
    document.getElementById('bpm-display').textContent = bpm;
  },

  nudgeSteps(d) {
    numSteps = Math.max(8, Math.min(300, numSteps + d));
    document.getElementById('steps-display').textContent = numSteps;
    renderRack();
  },

  clearAll() {
    patterns[activePat] = Array(MAX_ROWS).fill(null).map(() => Array(300).fill(false));
    GeminiSuggest.clearSuggestions();
    renderRack();
  },

  randomise() {
    const grid = getGrid();
    channelInstances.forEach((inst, r) => {
      const defIdx = INGREDIENT_DEFS.indexOf(inst.def);
      const threshold = defIdx === 0 ? 0.72 : defIdx < 3 ? 0.80 : 0.87;
      for (let s = 0; s < numSteps; s++) {
        grid[r][s] = Math.random() > threshold;
      }
    });
    GeminiSuggest.clearSuggestions();
    GeminiSuggest.notify(grid, numSteps);
    renderRack();
  }
};

/* ════════════════════════════════════════
   PATTERN SWITCHER
   ════════════════════════════════════════ */
function renderPatterns() {
  const c = document.getElementById('pat-btns');
  c.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const b = document.createElement('button');
    b.className = 'pat-btn' + (i === activePat ? ' active' : '');
    b.textContent = i + 1;
    b.onclick = () => {
      activePat = i;
      document.getElementById('stat-pat').textContent = i + 1;
      renderPatterns();
      GeminiSuggest.clearSuggestions();
      renderRack();
    };
    c.appendChild(b);
  }
}

/* ════════════════════════════════════════
   STATUS
   ════════════════════════════════════════ */
function updateStatus() {
  const grid  = getGrid();
  const total = channelInstances.reduce((sum, _, r) => sum + grid[r].slice(0, numSteps).filter(Boolean).length, 0);
  document.getElementById('stat-active').textContent = total;
}

/* ════════════════════════════════════════
   GEMINI CALLBACKS
   ════════════════════════════════════════ */
GeminiSuggest.onUpdate(
  (suggestions, bpmHint) => {
    if (bpmHint && Math.abs(bpmHint - bpm) >= 10) {
      bpm = bpmHint;
      document.getElementById('bpm-display').textContent = bpm;
    }
    renderRack();
    document.getElementById('gemini-indicator').style.display = 'block';
  },
  () => {
    renderRack();
    document.getElementById('gemini-indicator').style.display = 'none';
  }
);

/* ════════════════════════════════════════
   THEME / SETTINGS
   ════════════════════════════════════════ */
const UI = {
  toggleTheme() {
    const html = document.documentElement;
    const next = html.dataset.theme === 'light' ? 'dark' : 'light';
    html.dataset.theme = next;
    document.getElementById('theme-icon').textContent = next === 'dark' ? '☀' : '☽';
    localStorage.setItem('sushidaw-theme', next);
  },
  toggleSettings() {
    const d = document.getElementById('settings-drawer');
    d.classList.toggle('open');
    d.setAttribute('aria-hidden', d.classList.contains('open') ? 'false' : 'true');
  }
};

/* ════════════════════════════════════════
   BPM HOLD REPEAT
   ════════════════════════════════════════ */
['bpm-up','bpm-dn'].forEach(id => {
  const el = document.getElementById(id);
  let t = null;
  el?.addEventListener('mousedown', () => { t = setInterval(() => el.click(), 70); });
  ['mouseup','mouseleave'].forEach(ev => el?.addEventListener(ev, () => clearInterval(t)));
});

/* ════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space')  { e.preventDefault(); App.togglePlay(); }
  if (e.code === 'Escape') { App.stop(); Roll.close?.(); }
  if (e.code === 'Enter')  Roll.trigger?.();
});

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */
(function init() {
  const saved = localStorage.getItem('sushidaw-theme');
  if (saved) {
    document.documentElement.dataset.theme = saved;
    document.getElementById('theme-icon').textContent = saved === 'dark' ? '☀' : '☽';
  }
  renderPatterns();
  renderShelf();
  renderRack();
  window.addEventListener('resize', () => renderRack());
})();