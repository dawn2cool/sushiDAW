/* ════════════════════════════════════════
   app.js — SushiDAW
   Dynamic channels, ingredient shelf, pattern engine, UI.
   ════════════════════════════════════════ */

const INGREDIENT_DEFS = [
  { name:'cream cheese',  color:'#C8A840' },
  { name:'salmon',        color:'#E85038' },
  { name:'tuna',          color:'#B01828' },
  { name:'avocado',       color:'#3A8030' },
  { name:'cucumber',      color:'#1A9058' },
  { name:'egg',           color:'#D09010' },
  { name:'prawn',         color:'#C84028' },
  { name:'wasabi',        color:'#1A5030' },
];

let channelInstances = INGREDIENT_DEFS.map((def, i) => ({
  def,
  instanceNum: 1,
  id: i,
}));
let nextId = INGREDIENT_DEFS.length;

// Drag state variables
let isDragging = false;
let dragAction = true;

function countInstances(name) {
  return channelInstances.filter(c => c.def.name === name).length;
}

/* ════════════════════════════════════════
   SEQUENCER STATE
   ════════════════════════════════════════ */
let numSteps   = 16;
let bpm        = 128;
let playing    = false;
let curStep    = -1;
let uiStep     = -1;
let schedTimer = null;
let nextTime   = 0;
let activePat  = 0;

const MAX_ROWS = 100;
const patterns = Array(4).fill(null).map(() =>
  Array(MAX_ROWS).fill(null).map(() =>
    Array(300).fill(null).map(() => ({ active: false, subNotes: [null, null, null, null] }))
  )
);
const volumes    = Array(MAX_ROWS).fill(0.75);
const muted      = Array(MAX_ROWS).fill(false);

const getGrid = () => patterns[activePat];

/* ════════════════════════════════════════
   UI HELPERS
   ════════════════════════════════════════ */
function cellW() {
  const scroll = document.getElementById('rack-scroll');
  const lw     = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--label-w') || '148');
  const avail  = (scroll?.clientWidth || 600) - lw - 24;
  const gaps   = (numSteps - 1) * 3 + (Math.floor(numSteps / 4) - 1) * 6;
  return Math.max(24, Math.min(36, Math.floor((avail - gaps) / numSteps)));
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
      n.style.height = '14px';
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

    row.style.setProperty('--row-accent', ch.color);

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
        cell.style.height = cw + 'px';
        cell.dataset.ch = baseIdx < 8 ? baseIdx : 'ai';
        cell.dataset.s  = idx;

        // Force AI ingredient colors
        if (baseIdx >= 8) {
          if (isOn) {
            cell.style.background = ch.color;
            cell.style.borderColor = 'rgba(0,0,0,0.2)';
          } else if (isGhost) {
            cell.style.background = ch.color + '22';
          } else {
            cell.style.background = ch.color + '15';
            cell.style.borderColor = 'transparent';
          }
        }

        if (isOn && uiStep === idx && playing) cell.classList.add('playing');

        // Drag functionality
        cell.onmousedown = (e) => {
          isDragging = true;
          dragAction = !cellData.active;
          handleCellClick(r, idx, ch, cell);
        };
        cell.onmouseenter = () => {
          if (isDragging && cellData.active !== dragAction) {
            handleCellClick(r, idx, ch, cell);
          }
        };
        cell.oncontextmenu = (e) => {
          e.preventDefault();
          openPianoRoll(r);
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
function openPianoRoll(row) {
  const overlay = document.getElementById('piano-roll-overlay');
  const gridContainer = document.getElementById('piano-roll-grid');
  const sidebar = document.querySelector('.piano-keys-sidebar');
  const titleEl = overlay.querySelector('.piano-roll-header span');

  const ingredientName = channelInstances[row].def.name;
  if (titleEl) titleEl.textContent = `${ingredientName.toUpperCase()} Editor`;

  const ingredientColor = channelInstances[row].def.color;
  overlay.style.setProperty('--row-color', ingredientColor);

  const header = overlay.querySelector('.piano-roll-header');
  let clearBtn = header && header.querySelector('.clear-roll-btn');
  if (header && !clearBtn) {
    clearBtn = document.createElement('button');
    clearBtn.className = 'done-btn clear-roll-btn';
    clearBtn.style.cssText = 'background:var(--surface2);color:var(--ink);';
    clearBtn.textContent = 'Clear';
    const doneBtn = header.querySelector('.done-btn');
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:6px;align-items:center;';
    doneBtn.parentNode.insertBefore(btnGroup, doneBtn);
    btnGroup.appendChild(clearBtn);
    btnGroup.appendChild(doneBtn);
  }
  if (clearBtn) {
    clearBtn.onclick = () => {
      const rowData = getGrid()[row];
      for (let s = 0; s < numSteps; s++) {
        rowData[s].active = false;
        rowData[s].subNotes = [null, null, null, null];
      }
      gridContainer.querySelectorAll('.sub-cell').forEach(c => c.classList.remove('active'));
      renderRack();
    };
  }

  overlay.classList.remove('hidden');
  gridContainer.innerHTML = '';
  sidebar.innerHTML = '';

  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = `repeat(${numSteps}, 1fr)`;

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
    for (let s = 0; s < numSteps; s++) {
      const subCell = document.createElement('div');
      subCell.className = 'sub-cell';
      const currentData = getGrid()[row][s];
      const pitch = 11 - noteIdx;

      if (currentData.active && currentData.subNotes[0] === pitch) {
        subCell.classList.add('active');
      }

      subCell.onclick = () => {
        if (subCell.classList.contains('active')) {
          subCell.classList.remove('active');
          currentData.active = false;
          currentData.subNotes[0] = null;
        } else {
          const columnCells = gridContainer.querySelectorAll(`.sub-cell:nth-child(${numSteps}n + ${s + 1})`);
          columnCells.forEach(c => c.classList.remove('active'));

          subCell.classList.add('active');
          currentData.active = true;
          currentData.subNotes[0] = pitch;

          Audio.init(); Audio.resume();
          const baseIdx = INGREDIENT_DEFS.findIndex(d => d.name === ingredientName);
          Audio.playNote(baseIdx, Audio.currentTime(), volumes[row], pitch);
        }
        renderRack();
      };
      gridContainer.appendChild(subCell);
    }
  }
}

function closePianoRoll() {
  document.getElementById('piano-roll-overlay').classList.add('hidden');
}

/* ── CELL CLICK ── */
function handleCellClick(r, idx, ch, cell) {
  const grid = getGrid();
  const cellData = grid[r][idx];
  const inst = channelInstances[r];
  const baseIdx = INGREDIENT_DEFS.findIndex(d => d.name === inst.def.name);

  if (cell.classList.contains('ghost')) {
    cellData.active = true;
    GeminiSuggest.acceptSuggestion(r, idx);
    renderRack();
    Audio.init(); Audio.resume();
    const p = (cellData.subNotes && cellData.subNotes[0] !== null) ? cellData.subNotes[0] : 0;
    Audio.playNote(baseIdx, Audio.currentTime(), volumes[r], p);
    return;
  }

  cellData.active = !cellData.active;
  if (cellData.active) {
    cell.classList.add('on', 'bounce');

    // Apply AI color on manual click
    if (baseIdx >= 8) {
      cell.style.background  = ch.color;
      cell.style.borderColor = 'rgba(0,0,0,0.2)';
    }
    setTimeout(() => cell.classList.remove('bounce'), 150);
    Audio.init(); Audio.resume();
    const p = (cellData.subNotes && cellData.subNotes[0] !== null) ? cellData.subNotes[0] : 0;
    Audio.playNote(baseIdx, Audio.currentTime(), volumes[r], p);
  } else {
    cellData.subNotes = [null, null, null, null];
    cell.classList.remove('on');
    // Reset AI color
    if (baseIdx >= 8) {
      cell.style.background  = ch.color + '15';
      cell.style.borderColor = 'transparent';
    }
  }

  if (typeof GeminiSuggest !== 'undefined') {
    GeminiSuggest.clearSuggestions();
    GeminiSuggest.notify(grid, numSteps);
  }
  updateStatus();
}

/* ── SEQUENCER ENGINE (MULTI-PATTERN PLAYBACK) ── */
function schedule() {
  if (!playing) return;
  const ahead = 0.1;
  const dur = 60 / bpm / 4;

  while (nextTime < Audio.currentTime() + ahead) {
    curStep = (curStep + 1) % numSteps;

    // Iterate through all pattern layers
    patterns.forEach((grid) => {
      channelInstances.forEach((inst, r) => {
        const cell = grid[r][curStep];
        if (cell && cell.active && !muted[r]) {
          const baseIdx = INGREDIENT_DEFS.findIndex(d => d.name === inst.def.name);
          const voiceIdx = inst.def.voiceIdx !== undefined ? inst.def.voiceIdx : baseIdx;

          if (cell.subNotes && cell.subNotes.some(n => n !== null)) {
            const subStepDur = dur / 4;
            cell.subNotes.forEach((p, i) => {
              if (p !== null) Audio.playNote(voiceIdx, nextTime + (i * subStepDur), volumes[r], p);
            });
          } else {
            Audio.playNote(voiceIdx, nextTime, volumes[r], 0);
          }
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
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('playing', 'playing-off'));
    const activeColumn = document.querySelectorAll(`.cell[data-s="${s}"]`);
    activeColumn.forEach(c => {
      if (c.classList.contains('on')) c.classList.add('playing');
      else c.classList.add('playing-off');
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
  for (let p = 0; p < patterns.length; p++) {
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
  for (let p = 0; p < patterns.length; p++) {
    patterns[p].splice(rowIdx, 1);
  }
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
    pill.style.borderColor = def.color + '70';
    pill.style.background = def.color + '18';
    container.appendChild(pill);
  });
}

/* ── MASCOT LOGIC ── */
/* ── MASCOT LOGIC ── */
const Mascot = {
  el: null,
  sprite: null,
  idlePhrases: [
    "tip: Click an ingredient to change the sound !", 
    "tip: Use the BPM slider to speed up !", 
    "tip: click and drag notes to duplicate !"

  ],
  playingPhrases: [
    "ready to roll !", 
    "yes chef !", 
    "fresh as hell !",
    "sick beat !",
    "that shit is dope !",
    "what the fuck IS indie ?!"
  ],

  init() {
    this.el = document.getElementById('mascot-bubble');
    this.sprite = document.getElementById('mascot-sprite');
    
    // Start talking immediately
    this.updateMood(false); 
    
    // START THE 10-SECOND CYCLE
    this.startSpeechCycle();
  },

  startSpeechCycle() {
    if (this.cycle) clearInterval(this.cycle);
    this.cycle = setInterval(() => {
        this.el.classList.remove('show');
        setTimeout(() => {
            const phrases = playing ? this.playingPhrases : this.idlePhrases; // ← was Sequencer.isPlaying
            this.el.textContent = phrases[Math.floor(Math.random() * phrases.length)];
            this.el.classList.add('show');
        }, 1000);
    }, 10000);
},

  updateMood(isPlaying) {
    if (!this.sprite) return;
    
    // Path check: ../ because app.js is in /js/ folder
    const imgUrl = isPlaying ? "../mascot_right.jpg" : "../mascot_left.png";
    this.sprite.style.backgroundImage = `url('${imgUrl}')`;

    // Make bubble pop up immediately when you hit play/stop
    this.el.classList.remove('show');
    setTimeout(() => {
      const phrases = isPlaying ? this.playingPhrases : this.idlePhrases;
      this.el.textContent = phrases[Math.floor(Math.random() * phrases.length)];
      this.el.classList.add('show');
    }, 200);
  }
};

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
    playing = false;        // ← this line is missing
    this.isPlaying = false;
    if (typeof schedTimer !== 'undefined') clearTimeout(schedTimer);
    curStep = -1;
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('playing','playing-off'));
    const playBtn = document.getElementById('btn-play');
    if (playBtn) playBtn.textContent = '▶';
    if (window.Mascot) Mascot.updateMood(false);
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
  },
  randomise() {
    const grid = getGrid();
    channelInstances.forEach((inst, r) => {
      const defIdx = INGREDIENT_DEFS.indexOf(inst.def);
      const threshold = defIdx === 0 ? 0.72 : defIdx < 3 ? 0.80 : 0.87;
      for (let s = 0; s < numSteps; s++) {
        grid[r][s].active = Math.random() > threshold;
        grid[r][s].subNotes = [null, null, null, null];
      }
    });
    if (typeof GeminiSuggest !== 'undefined') GeminiSuggest.clearSuggestions();
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

/* ════════════════════════════════════════
   PATTERN SWITCHER
   ════════════════════════════════════════ */
function renderPatterns() {
  const c = document.getElementById('pat-btns');
  if (!c) return;
  c.innerHTML = '';
  for (let i = 0; i < patterns.length; i++) {
      const b = document.createElement('button');
      b.className = 'pat-btn' + (i === activePat ? ' active' : '');
      b.textContent = i + 1;
      b.onclick = () => {
        activePat = i;
        renderPatterns();
        if (typeof GeminiSuggest !== 'undefined') GeminiSuggest.clearSuggestions();
        renderRack();
      };
      c.appendChild(b);
  }
  const addBtn = document.createElement('button');
  addBtn.className = 'pat-btn';
  addBtn.textContent = '+';
  addBtn.style.color = 'var(--accent)';
  addBtn.style.fontWeight = 'bold';
  addBtn.title = 'Add new pattern layer';
  addBtn.onclick = () => {
    const newGrid = Array(MAX_ROWS).fill(null).map(() =>
      Array(300).fill(null).map(() => ({ active: false, subNotes: [null, null, null, null] }))
    );
    patterns.push(newGrid);
    activePat = patterns.length - 1;
    renderPatterns();
    if (typeof GeminiSuggest !== 'undefined') GeminiSuggest.clearSuggestions();
    renderRack();
  };
  c.appendChild(addBtn);
}

/* ════════════════════════════════════════
   THEME
   ════════════════════════════════════════ */
const UI = {
  toggleTheme() {
    const html = document.documentElement;
    const next = html.dataset.theme === 'light' ? 'dark' : 'light';
    html.dataset.theme = next;
    document.getElementById('theme-icon').textContent = next === 'dark' ? '☀' : '☽';
    localStorage.setItem('sushidaw-theme', next);
  }
};

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */
(function init() {
  const saved = localStorage.getItem('sushidaw-theme');
  Mascot.init();
  if (saved) {
    document.documentElement.dataset.theme = saved;
    document.getElementById('theme-icon').textContent = saved === 'dark' ? '☀' : '☽';
  }

  renderPatterns();
  renderShelf();
  renderRack();

  window.addEventListener('mouseup', () => { isDragging = false; }); // Global mouseup
  window.addEventListener('resize', () => renderRack());
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Escape') closePianoRoll();
    if (e.code === 'Space') {
      e.preventDefault();
      App.togglePlay();
    }
  });
})();