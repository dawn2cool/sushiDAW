/*
  app.js — SushiDAW main application.
  Handles sequencer state, rendering, transport, and UI events.
*/

/* ── CHANNEL DEFINITIONS ── */
const CHANNELS = [
  { name:'Rice',     emoji:'🍚', color:'#C8A840', bgColor:'#E8D89A' },
  { name:'Salmon',   emoji:'🐟', color:'#E85038', bgColor:'#F09070' },
  { name:'Tuna',     emoji:'🔴', color:'#B01828', bgColor:'#D04860' },
  { name:'Avocado',  emoji:'🥑', color:'#3A8030', bgColor:'#70B860' },
  { name:'Cucumber', emoji:'🥒', color:'#1A9058', bgColor:'#60C090' },
  { name:'Egg',      emoji:'🥚', color:'#D09010', bgColor:'#F0C840' },
  { name:'Prawn',    emoji:'🦐', color:'#C84028', bgColor:'#E87858' },
  { name:'Seaweed',  emoji:'🌿', color:'#1A5030', bgColor:'#3A8050' },
];

/* ── STATE ── */
let numSteps  = 16;
let bpm       = 128;
let playing   = false;
let curStep   = -1;
let uiStep    = -1;
let schedTimer = null;
let nextTime  = 0;
let activePat = 0;

// 4 patterns × 8 channels × 32 steps
const patterns = Array(4).fill(null).map(() => CHANNELS.map(() => Array(32).fill(false)));
const volumes  = CHANNELS.map(() => 0.75);
const muted    = CHANNELS.map(() => false);

const getGrid = () => patterns[activePat];

/* ── CELL WIDTH ── */
function cellW() {
  const scroll  = document.getElementById('rack-scroll');
  const lw      = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--label-w') || '152');
  const avail   = (scroll?.clientWidth || 600) - lw - 28;
  const gaps    = (numSteps - 1) * 3 + (Math.floor(numSteps / 4) - 1) * 6;
  return Math.max(18, Math.min(28, Math.floor((avail - gaps) / numSteps)));
}

/* ── RENDER STEP HEADER ── */
function renderHeader() {
  const el  = document.getElementById('step-header');
  const cw  = cellW();
  el.innerHTML = '';
  for (let g = 0; g < numSteps / 4; g++) {
    const grp = document.createElement('div');
    grp.className = 'step-grp-h';
    if (g > 0) grp.style.marginLeft = '6px';
    for (let s = 0; s < 4; s++) {
      const n = document.createElement('div');
      n.className = 'step-num' + (s === 0 ? ' beat' : '');
      n.style.width  = cw + 'px';
      n.textContent  = g * 4 + s + 1;
      grp.appendChild(n);
    }
    el.appendChild(grp);
  }
}

/* ── RENDER RACK ── */
function renderRack() {
  const rack = document.getElementById('rack');
  rack.innerHTML = '';
  const grid    = getGrid();
  const cw      = cellW();
  const ghosts  = GeminiSuggest.getSuggestions();

  CHANNELS.forEach((ch, r) => {
    const row = document.createElement('div');
    row.className = 'channel-row';

    /* Label */
    const lbl = document.createElement('div');
    lbl.className = 'ch-label';

    const dot = document.createElement('div');
    dot.className = 'ch-dot';
    dot.style.background = ch.color;

    const emoji = document.createElement('span');
    emoji.className = 'ch-emoji';
    emoji.textContent = ch.emoji;

    const name = document.createElement('span');
    name.className = 'ch-name';
    name.textContent = ch.name;

    const muteBtn = document.createElement('button');
    muteBtn.className = 'mute-btn' + (muted[r] ? ' muted' : '');
    muteBtn.textContent = 'M';
    muteBtn.onclick = () => { muted[r] = !muted[r]; muteBtn.classList.toggle('muted', muted[r]); };

    const volWrap = buildVolume(r, ch);

    lbl.append(dot, emoji, name, muteBtn, volWrap);
    row.appendChild(lbl);

    /* Steps */
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

        if (isOn && uiStep === idx && playing) {
          cell.classList.add('playing');
        }

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

/* ── CELL CLICK ── */
function handleCellClick(r, idx, ch, cell) {
  const grid    = getGrid();
  const isGhost = cell.classList.contains('ghost');

  if (isGhost) {
    // Accept ghost suggestion
    grid[r][idx] = true;
    GeminiSuggest.acceptSuggestion(r, idx);
    renderRack();
    Audio.init(); Audio.resume();
    Audio.playNote(r, Audio.currentTime(), volumes[r]);
    return;
  }

  grid[r][idx] = !grid[r][idx];

  if (grid[r][idx]) {
    cell.classList.add('on', 'bounce');
    setTimeout(() => cell.classList.remove('bounce'), 130);
    Audio.init(); Audio.resume();
    Audio.playNote(r, Audio.currentTime(), volumes[r]);
  } else {
    cell.classList.remove('on');
  }

  GeminiSuggest.clearSuggestions();
  GeminiSuggest.notify(grid, numSteps);
  updateStatus();
}

/* ── VOLUME WIDGET ── */
function buildVolume(r, ch) {
  const wrap  = document.createElement('div');
  wrap.className = 'vol-wrap';
  const track = document.createElement('div');
  track.className = 'vol-track';
  const fill  = document.createElement('div');
  fill.className = 'vol-fill';
  fill.style.cssText = `width:${volumes[r]*100}%; background:${ch.color};`;
  const thumb = document.createElement('div');
  thumb.className = 'vol-thumb';
  thumb.style.cssText = `left:${volumes[r]*100}%; border-color:${ch.color}55;`;
  track.append(fill, thumb);
  wrap.appendChild(track);

  let drag = false;
  const upd = e => {
    const rect = track.getBoundingClientRect();
    const x    = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    const p    = Math.max(0, Math.min(1, x / rect.width));
    volumes[r] = p;
    fill.style.width  = (p * 100) + '%';
    thumb.style.left  = (p * 100) + '%';
  };
  thumb.addEventListener('mousedown', e => { e.stopPropagation(); drag = true; });
  track.addEventListener('mousedown', e => { drag = true; upd(e); });
  window.addEventListener('mousemove', e => { if (drag) upd(e); });
  window.addEventListener('mouseup',   () => { drag = false; });
  return wrap;
}

/* ── SEQUENCER ── */
function schedule() {
  if (!playing) return;
  const ahead = 0.1;
  const dur   = 60 / bpm / 4;
  const grid  = getGrid();

  while (nextTime < Audio.currentTime() + ahead) {
    curStep = (curStep + 1) % numSteps;
    grid.forEach((row, ch) => {
      if (row[curStep] && !muted[ch]) Audio.playNote(ch, nextTime, volumes[ch]);
    });
    animateStep(curStep);
    nextTime += dur;
  }
  schedTimer = setTimeout(schedule, 25);
}

function animateStep(s) {
  requestAnimationFrame(() => {
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('playing', 'playing-off'));
    document.querySelectorAll(`.cell[data-s="${s}"]`).forEach(c => {
      c.classList.add(c.classList.contains('on') ? 'playing' : 'playing-off');
    });
    document.getElementById('r-step').textContent = s + 1;
    document.getElementById('r-bar').textContent  = Math.floor(s / 4) + 1;
    uiStep = s;
  });
}

/* ── TRANSPORT CONTROLS ── */
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
    numSteps = Math.max(8, Math.min(32, numSteps + d));
    document.getElementById('steps-display').textContent = numSteps;
    renderRack();
  },

  clearAll() {
    patterns[activePat] = CHANNELS.map(() => Array(32).fill(false));
    GeminiSuggest.clearSuggestions();
    renderRack();
  },

  randomise() {
    patterns[activePat] = CHANNELS.map((_, i) =>
      Array(numSteps).fill(0).map(() => Math.random() > (i === 0 ? 0.75 : i < 3 ? 0.82 : 0.88))
    );
    GeminiSuggest.clearSuggestions();
    GeminiSuggest.notify(getGrid(), numSteps);
    renderRack();
  }
};

/* ── PATTERN SWITCHER ── */
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

/* ── STATUS ── */
function updateStatus() {
  const total = getGrid().flat().filter(Boolean).length;
  document.getElementById('stat-active').textContent = total;
}

/* ── GEMINI CALLBACKS ── */
GeminiSuggest.onUpdate(
  (suggestions, bpmHint) => {
    // Apply BPM hint if significantly different (±10)
    if (bpmHint && Math.abs(bpmHint - bpm) >= 10) {
      bpm = bpmHint;
      document.getElementById('bpm-display').textContent = bpm;
    }
    // Show ghost cells
    renderRack();
    const ind = document.getElementById('gemini-indicator');
    ind.style.display = 'block';
  },
  () => {
    renderRack();
    document.getElementById('gemini-indicator').style.display = 'none';
  }
);

/* ── THEME ── */
const UI = {
  toggleTheme() {
    const html = document.documentElement;
    const next = html.dataset.theme === 'light' ? 'dark' : 'light';
    html.dataset.theme = next;
    document.getElementById('theme-icon').textContent = next === 'dark' ? '☀' : '☽';
    localStorage.setItem('sushidaw-theme', next);
  },

  toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    drawer.classList.toggle('open');
    drawer.setAttribute('aria-hidden', drawer.classList.contains('open') ? 'false' : 'true');
  }
};

/* ── BPM HOLD REPEAT ── */
['bpm-up','bpm-dn'].forEach(id => {
  const el = document.getElementById(id);
  let t = null;
  el?.addEventListener('mousedown', () => { t = setInterval(() => el.click(), 70); });
  ['mouseup','mouseleave'].forEach(ev => el?.addEventListener(ev, () => clearInterval(t)));
});

/* ── KEYBOARD SHORTCUTS ── */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); App.togglePlay(); }
  if (e.code === 'Escape') App.stop();
});

/* ── INIT ── */
(function init() {
  const saved = localStorage.getItem('sushidaw-theme');
  if (saved) {
    document.documentElement.dataset.theme = saved;
    document.getElementById('theme-icon').textContent = saved === 'dark' ? '☀' : '☽';
  }
  renderPatterns();
  renderRack();
  window.addEventListener('resize', () => renderRack());
})();