/* ════════════════════════════════════════
   app.js — SushiDAW
   Dynamic channels, ingredient shelf, pattern engine, UI.
   ════════════════════════════════════════ */

const INGREDIENT_DEFS = [
  { name:'cream cheese', color:'#C8A840' },
  { name:'salmon', color:'#E85038' },
  { name:'tuna', color:'#B01828' },
  { name:'avocado', color:'#3A8030' },
  { name:'cucumber', color:'#1A9058' },
  { name:'egg', color:'#D09010' },
  { name:'prawn', color:'#C84028' },
  { name:'wasabi', color:'#1A5030' },
];

let channelInstances = INGREDIENT_DEFS.map((def, i) => ({
  def,
  instanceNum: 1,
  id: i,
}));
let nextId = INGREDIENT_DEFS.length;

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

const MAX_ROWS = 100;
const patterns = Array(4).fill(null).map(() =>
  Array(MAX_ROWS).fill(null).map(() => 
    Array(300).fill(null).map(() => ({ active: false, subNotes: [null, null, null, null] }))
  )
);
const volumes  = Array(MAX_ROWS).fill(0.75);
const muted    = Array(MAX_ROWS).fill(false);

const getGrid = () => patterns[activePat];

/* ════════════════════════════════════════
   UI HELPERS
   ════════════════════════════════════════ */
function cellW() {
  const scroll = document.getElementById('rack-scroll');
  const lw     = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--label-w') || '148');
  const avail  = (scroll?.clientWidth || 600) - lw - 24;
  const gaps   = (numSteps - 1) * 3 + (Math.floor(numSteps / 4) - 1) * 6;
  return Math.max(16, Math.min(28, Math.floor((avail - gaps) / numSteps)));
}

function renderHeader() {
  const el = document.getElementById('step-header');
  if(!el) return;
  const cw = cellW();
  el.innerHTML = '';

  const headerWrapper = document.createElement('div');
  headerWrapper.style.display = 'flex';
  headerWrapper.style.alignItems = 'center';
  headerWrapper.style.padding = '0 10px';
  headerWrapper.style.gap = '3px';

  for (let g = 0; g < numSteps / 4; g++) {
    const grp = document.createElement('div');
    grp.className = 'step-grp-h';
    grp.style.display = 'flex';
    grp.style.gap = '3px';
    if (g > 0) grp.style.marginLeft = '6px';

    for (let s = 0; s < 4; s++) {
      const n = document.createElement('div');
      n.className = 'step-num' + (s === 0 ? ' beat' : '');
      n.style.width = cw + 'px';
      n.style.textAlign = 'center';
      n.textContent = g * 4 + s + 1;
      grp.appendChild(n);
    }
    headerWrapper.appendChild(grp);
  }
  el.appendChild(headerWrapper);
}

/* ── RENDER RACK ── */
function renderRack() {
  const rack = document.getElementById('rack');
  if (!rack) return;
  
  rack.innerHTML = '';
  const grid     = getGrid();
  const cw       = cellW();
  const ghosts   = (typeof GeminiSuggest !== 'undefined') ? GeminiSuggest.getSuggestions() : [];

  channelInstances.forEach((inst, r) => {
    const ch  = inst.def;
    const row = document.createElement('div');
    row.className = 'channel-row';

    const lbl = document.createElement('div');
    lbl.className = 'ch-label';

    const dot = document.createElement('div');
    dot.className = 'ch-dot';
    dot.style.background = ch.color;

    const name = document.createElement('span');
    name.className = 'ch-name';
    name.textContent = ch.name;

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
    muteBtn.onclick = (e) => { 
      e.stopPropagation();
      muted[r] = !muted[r]; 
      muteBtn.classList.toggle('muted', muted[r]); 
    };

    lbl.append(muteBtn, buildVolume(r, ch));
    
    if (countInstances(ch.name) > 1) {
       const rmBtn = document.createElement('button');
       rmBtn.className = 'remove-btn';
       rmBtn.textContent = '×';
       rmBtn.onclick = () => removeChannelInstance(r);
       lbl.append(rmBtn);
    }

    row.appendChild(lbl);

    const stepsEl = document.createElement('div');
    stepsEl.className = 'ch-steps';

    const baseIdx = INGREDIENT_DEFS.findIndex(d => d.name === ch.name);

    for (let g = 0; g < numSteps / 4; g++) {
      const grp = document.createElement('div');
      grp.className = 'step-grp';
      if (g > 0) grp.style.marginLeft = '6px';

      for (let s = 0; s < 4; s++) {
        const idx = g * 4 + s;
        const cellData = grid[r][idx];
        const isOn = cellData && cellData.active;
        const isGhost = !isOn && ghosts.some(gs => gs.row === r && gs.step === idx);

        const cell = document.createElement('div');
        cell.className = 'cell' + (isOn ? ' on' : '') + (isGhost ? ' ghost' : '');
        cell.style.width  = cw + 'px';
        cell.dataset.ch = baseIdx < 8 ? baseIdx : 'ai';
        cell.dataset.s  = idx;

        if (baseIdx >= 8) {
          cell.style.background = isOn ? ch.color : ch.color + '22';
          cell.style.borderColor = isOn ? ch.color : ch.color + '11';
        }

        if (isOn && uiStep === idx && playing) cell.classList.add('playing');

        cell.onclick = () => handleCellClick(r, idx, ch, cell);
        cell.oncontextmenu = (e) => {
          e.preventDefault();
          openPianoRoll(r, idx);
        };
        grp.appendChild(cell);
      }
      stepsEl.appendChild(grp);
    }
    row.appendChild(stepsEl);
    rack.appendChild(row);
  });
  renderHeader();
}

/* ── PIANO ROLL LOGIC ── */
function openPianoRoll(row, step) {
  const overlay = document.getElementById('piano-roll-overlay');
  const gridContainer = document.getElementById('piano-roll-grid');
  const sidebar = document.querySelector('.piano-keys-sidebar');
  const titleEl = overlay.querySelector('.piano-roll-header span');
  
  const ingredientName = channelInstances[row].def.name;
  if (titleEl) titleEl.textContent = `${ingredientName.toUpperCase()} Editor`;
  
  overlay.classList.remove('hidden');
  gridContainer.innerHTML = '';
  sidebar.innerHTML = '';

  const notes = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
  notes.forEach((note, i) => {
    const key = document.createElement('div');
    key.className = `piano-key ${note.includes('#') ? 'black' : 'white'}`;
    key.textContent = note;
    key.onclick = () => {
      Audio.init(); Audio.resume();
      const baseIdx = INGREDIENT_DEFS.findIndex(d => d.name === ingredientName);
      Audio.playNote(baseIdx, Audio.currentTime(), volumes[row], 11 - i);
    };
    sidebar.appendChild(key);
  });

  for (let noteIdx = 0; noteIdx < 12; noteIdx++) {
    for (let subStep = 0; subStep < 4; subStep++) {
      const subCell = document.createElement('div');
      subCell.className = 'sub-cell';
      const currentData = getGrid()[row][step];
      if (currentData.subNotes[subStep] === (11 - noteIdx)) {
        subCell.classList.add('active');
      }

      subCell.onclick = () => {
        subCell.classList.toggle('active');
        saveSubNote(row, step, subStep, 11 - noteIdx);
        if (subCell.classList.contains('active')) {
          const baseIdx = INGREDIENT_DEFS.findIndex(d => d.name === ingredientName);
          Audio.playNote(baseIdx, Audio.currentTime(), volumes[row], 11 - noteIdx);
        }
      };
      gridContainer.appendChild(subCell);
    }
  }
}

function saveSubNote(row, step, subStep, pitch) {
  const grid = getGrid();
  const cell = grid[row][step];
  if (cell.subNotes[subStep] === pitch) {
    cell.subNotes[subStep] = null;
  } else {
    cell.subNotes[subStep] = pitch;
  }
  cell.active = cell.subNotes.some(n => n !== null);
  renderRack();
}

function closePianoRoll() {
  document.getElementById('piano-roll-overlay').classList.add('hidden');
}

/* ── CELL CLICK ── */
function handleCellClick(r, idx, ch, cell) {
  const grid = getGrid();
  const cellData = grid[r][idx];
  const inst = channelInstances[r];

  if (cell.classList.contains('ghost')) {
    cellData.active = true;
    GeminiSuggest.acceptSuggestion(r, idx);
    renderRack();
    Audio.init(); Audio.resume();
    const baseIdx = INGREDIENT_DEFS.findIndex(d => d.name === inst.def.name);
    const p = (cellData.subNotes && cellData.subNotes[0] !== null) ? cellData.subNotes[0] : 0;
    Audio.playNote(baseIdx, Audio.currentTime(), volumes[r], p);
    return;
  }

  cellData.active = !cellData.active;
  if (cellData.active) {
    cell.classList.add('on', 'bounce');
    setTimeout(() => cell.classList.remove('bounce'), 150);
    Audio.init(); Audio.resume();
    const baseIdx = INGREDIENT_DEFS.findIndex(d => d.name === inst.def.name);
    const p = (cellData.subNotes && cellData.subNotes[0] !== null) ? cellData.subNotes[0] : 0;
    Audio.playNote(baseIdx, Audio.currentTime(), volumes[r], p);
  } else {
    cellData.subNotes = [null, null, null, null]; 
    cell.classList.remove('on');
  }

  GeminiSuggest.clearSuggestions();
  GeminiSuggest.notify(grid, numSteps);
  updateStatus();
}

/* ── SEQUENCER ENGINE ── */
function schedule() {
  if (!playing) return;
  const ahead = 0.1;
  const dur = 60 / bpm / 4; 
  const grid = getGrid();

  while (nextTime < Audio.currentTime() + ahead) {
    curStep = (curStep + 1) % numSteps;
    
    channelInstances.forEach((inst, r) => {
      const cell = grid[r][curStep];
      if (cell && cell.active && !muted[r]) {
        const baseIdx = INGREDIENT_DEFS.findIndex(d => d.name === inst.def.name);
        const hasMelody = cell.subNotes.some(n => n !== null);
        
        if (hasMelody) {
          const subStepDur = dur / 4;
          cell.subNotes.forEach((p, i) => {
            if (p !== null) {
              Audio.playNote(baseIdx, nextTime + (i * subStepDur), volumes[r], p);
            }
          });
        } else {
          Audio.playNote(baseIdx, nextTime, volumes[r], 0);
        }
      }
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
    uiStep = s;
  });
}

/* ── VOLUME WIDGET ── */
function buildVolume(r, ch) {
  const wrap = document.createElement('div');
  wrap.className = 'vol-wrap';
  const track = document.createElement('div');
  track.className = 'vol-track';
  const fill = document.createElement('div');
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
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left;
    const p = Math.max(0, Math.min(1, x / rect.width));
    volumes[r] = p;
    fill.style.width = (p*100)+'%';
    thumb.style.left = (p*100)+'%';
  };
  thumb.addEventListener('mousedown', e => { e.stopPropagation(); drag = true; });
  track.addEventListener('mousedown', e => { drag = true; upd(e); });
  window.addEventListener('mousemove', e => { if (drag) upd(e); });
  window.addEventListener('mouseup', () => { drag = false; });
  return wrap;
}

/* ── CHANNEL MANAGEMENT ── */
function addChannelInstance(def) {
  const existingCount = countInstances(def.name);
  if (existingCount >= 5) return;
  const newInst = { def, instanceNum: existingCount + 1, id: nextId++ };
  let insertIdx = channelInstances.length;
  for (let i = channelInstances.length - 1; i >= 0; i--) {
    if (channelInstances[i].def.name === def.name) { insertIdx = i + 1; break; }
  }
  channelInstances.splice(insertIdx, 0, newInst);
  for (let p = 0; p < 4; p++) {
    patterns[p].splice(insertIdx, 0, Array(300).fill(null).map(() => ({active:false, subNotes:[null,null,null,null]})));
  }
  volumes.splice(insertIdx, 0, 0.75);
  muted.splice(insertIdx, 0, false);
  renderShelf();
  renderRack();
}

function removeChannelInstance(rowIdx) {
  if (channelInstances.length <= 1) return;
  channelInstances.splice(rowIdx, 1);
  for (let p = 0; p < 4; p++) patterns[p].splice(rowIdx, 1);
  volumes.splice(rowIdx, 1);
  muted.splice(rowIdx, 1);
  renderShelf();
  renderRack();
}

/* ── SHELF ── */
function renderShelf() {
  const container = document.getElementById('shelf-pills');
  if(!container) return;
  container.innerHTML = '';
  INGREDIENT_DEFS.forEach(def => {
    const pill = document.createElement('div');
    pill.className = 'shelf-pill';
    pill.innerHTML = `<span class="shelf-pill-name">${def.name}</span><span class="shelf-pill-add">+</span>`;
    const count = countInstances(def.name);
    if(count > 1) pill.innerHTML += `<span class="shelf-pill-count visible">${count}</span>`;
    pill.onclick = () => addChannelInstance(def);
    pill.style.borderColor = def.color + '60';
    container.appendChild(pill);
  });
}

/* ── TRANSPORT ── */
const App = {
  togglePlay() {
    Audio.init(); Audio.resume();
    playing = !playing;
    const btn = document.getElementById('btn-play');
    if (playing) {
      curStep = -1;
      nextTime = Audio.currentTime();
      btn.textContent = '⏸';
      schedule();
    } else {
      clearTimeout(schedTimer);
      btn.textContent = '▶';
    }
  },
  stop() {
    playing = false;
    clearTimeout(schedTimer);
    curStep = -1;
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('playing','playing-off'));
    document.getElementById('btn-play').textContent = '▶';
  },
  nudgeBpm(d) {
    bpm = Math.max(40, Math.min(300, bpm + d));
    document.getElementById('bpm-display').textContent = bpm;
  },
  nudgeSteps(d) {
    numSteps = Math.max(8, Math.min(64, numSteps + d));
    document.getElementById('steps-display').textContent = numSteps;
    renderRack();
  },
  clearAll() {
    patterns[activePat].forEach(row => row.forEach(cell => {
        cell.active = false;
        cell.subNotes = [null,null,null,null];
    }));
    renderRack();
    updateStatus();
  }
};

function updateStatus() {
  const grid = getGrid();
  let total = 0;
  channelInstances.forEach((_, r) => {
    for(let s=0; s<numSteps; s++) if(grid[r][s].active) total++;
  });
  const el = document.getElementById('stat-active');
  if(el) el.textContent = total;
}

/* ── INIT ── */
(function init() {
  renderShelf();
  renderRack();
  window.addEventListener('resize', () => renderRack());
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape') closePianoRoll();
    if (e.code === 'Space') {
      e.preventDefault();
      App.togglePlay();
    }
  });
})();