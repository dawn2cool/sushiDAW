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

// EXPOSE TO GLOBAL SCOPE for roll.js and db.js
window.channelInstances = INGREDIENT_DEFS.map((def, i) => ({
  def,
  instanceNum: 1,
  id: i,
}));
let nextId = INGREDIENT_DEFS.length;

// Drag state variables
let isDragging = false;
let dragAction = true;

function countInstances(name) {
  return window.channelInstances.filter(c => c.def.name === name).length;
}

/* ════════════════════════════════════════
   SEQUENCER STATE
   ════════════════════════════════════════ */
window.numSteps   = 16;
window.bpm        = 128;
let playing    = false;
let curStep    = -1;
let uiStep     = -1;
let schedTimer = null;
let nextTime   = 0;
window.activePat  = 0;

const MAX_ROWS = 100;
window.patterns = Array(4).fill(null).map(() =>
  Array(MAX_ROWS).fill(null).map(() =>
    Array(300).fill(null).map(() => ({ active: false, subNotes: [null, null, null, null] }))
  )
);
const volumes    = Array(MAX_ROWS).fill(0.75);
const muted      = Array(MAX_ROWS).fill(false);

// EXPOSE TO GLOBAL SCOPE
window.getGrid = () => window.patterns[window.activePat];

/* ════════════════════════════════════════
   UI HELPERS
   ════════════════════════════════════════ */
function cellW() {
  const scroll = document.getElementById('rack-scroll');
  const lw     = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--label-w') || '148');
  const avail  = (scroll?.clientWidth || 600) - lw - 24;
  const gaps   = (window.numSteps - 1) * 3 + (Math.floor(window.numSteps / 4) - 1) * 6;
  return Math.max(24, Math.min(36, Math.floor((avail - gaps) / window.numSteps)));
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

  for (let g = 0; g < window.numSteps / 4; g++) {
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
  const grid     = window.getGrid();
  const cw       = cellW();
  const ghosts   = (typeof GeminiSuggest !== 'undefined') ? GeminiSuggest.getSuggestions() : [];

  window.channelInstances.forEach((inst, r) => {
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

    for (let g = 0; g < window.numSteps / 4; g++) {
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

  const ingredientName = window.channelInstances[row].def.name;
  if (titleEl) titleEl.textContent = `${ingredientName.toUpperCase()} Editor`;

  const ingredientColor = window.channelInstances[row].def.color;
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
      const rowData = window.getGrid()[row];
      for (let s = 0; s < window.numSteps; s++) {
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
  gridContainer.style.gridTemplateColumns = `repeat(${window.numSteps}, 1fr)`;

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
    for (let s = 0; s < window.numSteps; s++) {
      const subCell = document.createElement('div');
      subCell.className = 'sub-cell';
      const currentData = window.getGrid()[row][s];
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
          const columnCells = gridContainer.querySelectorAll(`.sub-cell:nth-child(${window.numSteps}n + ${s + 1})`);
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
  const grid = window.getGrid();
  const cellData = grid[r][idx];
  const inst = window.channelInstances[r];
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
    GeminiSuggest.notify(grid, window.numSteps);
  }
  updateStatus();
}

/* ── SEQUENCER ENGINE (MULTI-PATTERN PLAYBACK) ── */
function schedule() {
  if (!playing) return;
  const ahead = 0.1;
  const dur = 60 / window.bpm / 4;

  while (nextTime < Audio.currentTime() + ahead) {
    const isLastStep = curStep === window.numSteps - 1;
    curStep = (curStep + 1) % window.numSteps;

    // Trigger Finish Tag if we just wrapped around
    if (curStep === 0 && isLastStep && typeof ProducerTag !== 'undefined') {
       ProducerTag.onFinish();
    }

    // Iterate through all pattern layers
    window.patterns.forEach((grid) => {
      window.channelInstances.forEach((inst, r) => {
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
  let insertIdx = window.channelInstances.length;
  for (let i = window.channelInstances.length - 1; i >= 0; i--) {
    if (window.channelInstances[i].def.name === def.name) { insertIdx = i + 1; break; }
  }
  window.channelInstances.splice(insertIdx, 0, newInst);
  for (let p = 0; p < window.patterns.length; p++) {
    window.patterns[p].splice(insertIdx, 0, Array(300).fill(null).map(() => ({active:false, subNotes:[null,null,null,null]})));
  }
  volumes.splice(insertIdx, 0, 0.75);
  muted.splice(insertIdx, 0, false);
  renderShelf();
  renderRack();
}

function removeChannelInstance(rowIdx) {
  if (window.channelInstances.length <= 1) return;
  window.channelInstances.splice(rowIdx, 1);
  for (let p = 0; p < window.patterns.length; p++) {
    window.patterns[p].splice(rowIdx, 1);
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
    window.bpm = Math.max(40, Math.min(300, window.bpm + d));
    document.getElementById('bpm-display').textContent = window.bpm;
  },
  nudgeSteps(d) {
    window.numSteps = Math.max(8, Math.min(64, window.numSteps + d));
    document.getElementById('steps-display').textContent = window.numSteps;
    renderRack();
  },
  clearAll() {
    window.getGrid().forEach(row => row.forEach(cell => {
        cell.active = false;
        cell.subNotes = [null,null,null,null];
    }));
    renderRack();
    updateStatus();
  },
  randomise() {
    const grid = window.getGrid();
    window.channelInstances.forEach((inst, r) => {
      const defIdx = INGREDIENT_DEFS.indexOf(inst.def);
      const threshold = defIdx === 0 ? 0.72 : defIdx < 3 ? 0.80 : 0.87;
      for (let s = 0; s < window.numSteps; s++) {
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
  const grid = window.getGrid();
  let total = 0;
  window.channelInstances.forEach((_, r) => {
    for(let s=0; s<window.numSteps; s++) if(grid[r][s].active) total++;
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
  for (let i = 0; i < window.patterns.length; i++) {
      const b = document.createElement('button');
      b.className = 'pat-btn' + (i === window.activePat ? ' active' : '');
      b.textContent = i + 1;
      b.onclick = () => {
        window.activePat = i;
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
    window.patterns.push(newGrid);
    window.activePat = window.patterns.length - 1;
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
function init() {
  const saved = localStorage.getItem('sushidaw-theme');
  if (saved) {
    document.documentElement.dataset.theme = saved;
    document.getElementById('theme-icon').textContent = saved === 'dark' ? '☀' : '☽';
  }

  // ── Load Custom AI Ingredients from Storage ──
  try {
    const customIngs = JSON.parse(localStorage.getItem('sushidaw_custom_ingredients') || '[]');
    customIngs.forEach(ing => {
      // Re-register the synthesizer voice to get a valid voiceIdx in the audio engine
      const voiceIdx = (typeof Audio !== 'undefined' && Audio.addDynamicVoice)
                       ? Audio.addDynamicVoice(ing.synth)
                       : INGREDIENT_DEFS.length; // fallback

      // Push it back into the global shelf array
      INGREDIENT_DEFS.push({
        name: ing.name,
        color: ing.color,
        emoji: ing.emoji || '✨',
        voiceIdx: voiceIdx
      });
    });
  } catch (e) {
    console.error("Failed to load custom ingredients", e);
  }

  renderPatterns();
  renderShelf();
  renderRack();

  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('resize', () => renderRack());

  // Auth UI bootstrap — runs after DOM is fully set up
  if (typeof initAuthUI === 'function') initAuthUI();

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Escape') closePianoRoll();
    if (e.code === 'Space') {
      e.preventDefault();
      App.togglePlay();
    }
  });
}

// Ensure init runs after all scripts are loaded
window.addEventListener('load', init);

/* ════════════════════════════════════════
   AUTH + SAVE/HISTORY UI  —  Added features
   ════════════════════════════════════════ */

// ── Wire up auth UI on page load ─────────────────────────────
function initAuthUI() {
  if (typeof Auth === 'undefined') return;
  const user = Auth.getUser();
  if (user) {
    const pill = document.getElementById('user-pill');
    const name = document.getElementById('user-pill-name');
    if (pill) pill.style.display = 'flex';
    if (name) name.textContent   = user.producerTag || user.username;

    // Show save + history buttons
    const saveBtn        = document.getElementById('save-btn');
    const historyBtn     = document.getElementById('history-btn');
    const beatHistoryBtn = document.getElementById('beat-history-btn');
    if (saveBtn)        saveBtn.style.display        = 'flex';
    if (historyBtn)     historyBtn.style.display     = 'flex';
    if (beatHistoryBtn) beatHistoryBtn.style.display = 'flex';

    // Sync producer tag name
    if (typeof ProducerTag !== 'undefined') {
      ProducerTag.load();
    }
  } else {
    // Show the login button if the user is a guest
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.style.display = 'block';
  }
}

// ── App.triggerFinish — calls ProducerTag then Roll ──────────
App.triggerFinish = function() {
  Roll.trigger();
};

// ── Extend App.togglePlay to fire producer tag ───────────────
const _origTogglePlay = App.togglePlay.bind(App);
App.togglePlay = function() {
  const wasPlaying = playing;
  _origTogglePlay();

  // MODIFIED: Ensure producer tag fires every time play is initiated from a stop
  if (!wasPlaying && playing && typeof ProducerTag !== 'undefined') {
    ProducerTag.onPlay();
  }
};

/* ── UI namespace extensions ─────────────────────────────────── */
Object.assign(UI, {

  // ── Save beat modal ───────────────────────────────────────
  saveBeat() {
    if (!Auth.isLoggedIn()) {
      if(confirm('You need to log in to save beats. Go to login screen?')) {
        window.location.href = 'login.html';
      }
      return;
    }
    const overlay = document.getElementById('save-overlay');
    if (overlay) overlay.style.display = 'flex';
    const input = document.getElementById('save-name-input');
    if (input) { input.value = ''; input.focus(); }
    document.getElementById('save-status').textContent = '';
  },

  closeSave(e) {
    if (e && e.target !== document.getElementById('save-overlay')) return;
    document.getElementById('save-overlay').style.display = 'none';
  },

  async confirmSave() {
    const name   = (document.getElementById('save-name-input').value.trim()) || 'untitled beat';
    const status = document.getElementById('save-status');
    status.textContent = '⏳ saving...';
    try {
      const id = await DB.saveBeat(name);
      window._lastSavedBeatId = id;
      status.textContent = '✓ saved!';
      setTimeout(() => {
        document.getElementById('save-overlay').style.display = 'none';
        status.textContent = '';
      }, 1200);
    } catch (e) {
      status.textContent = '✗ ' + (e.message || 'save failed');
    }
  },

  // ── Beat history modal & Loading ─────────────────────────
  async openBeatHistory() {
    if (!Auth.isLoggedIn()) {
      if(confirm('You need to log in to see your beats. Go to login screen?')) {
        window.location.href = 'login.html';
      }
      return;
    }
    const overlay = document.getElementById('beat-history-overlay');
    const body    = document.getElementById('beat-history-body');
    if (!overlay) return;

    overlay.style.display = 'flex';
    body.innerHTML = '<div class="history-loading">loading...</div>';

    try {
      const beats = await DB.listBeats();
      if (!beats.length) {
        body.innerHTML = '<div class="history-empty">no beats yet!<br>save your first track 💾</div>';
        return;
      }
      body.innerHTML = '';
      beats.forEach(beat => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.style.cursor = 'pointer';

        const date  = new Date(beat.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });

        card.innerHTML = `
          <div class="hc-info" onclick="UI.loadBeat('${beat.id}', this)" style="flex-grow: 1;">
            <div class="hc-name">${beat.name}</div>
            <div class="hc-label">${beat.bpm} BPM • ${beat.numSteps} Steps</div>
            <div class="hc-date">${date}</div>
          </div>
          <button class="hc-delete" onclick="UI._deleteBeat('${beat.id}', this); event.stopPropagation();" title="delete">✕</button>
        `;
        body.appendChild(card);
      });
    } catch (e) {
      body.innerHTML = `<div class="history-empty">error loading beats<br><small>${e.message}</small></div>`;
    }
  },

  closeBeatHistory(e) {
    const overlay = document.getElementById('beat-history-overlay');
    if (e && e.target !== overlay) return;
    if (overlay) overlay.style.display = 'none';
  },

  async _deleteBeat(id, btn) {
    btn.textContent = '⏳';
    btn.disabled = true;
    await DB.deleteBeat(id);
    btn.closest('.history-card').remove();
    const body = document.getElementById('beat-history-body');
    if (!body.querySelector('.history-card')) {
      body.innerHTML = '<div class="history-empty">no beats yet!<br>save your first track 💾</div>';
    }
  },

  async loadBeat(id, element) {
    try {
      const origHtml = element.innerHTML;
      element.innerHTML = '<div class="hc-name">Loading...</div>';

      const fullBeat = await DB.getBeat(id);

      // 1. Stop playback
      if (typeof playing !== 'undefined' && playing) App.stop();

      // 2. Update Globals
      window.bpm = fullBeat.bpm;
      window.numSteps = fullBeat.numSteps;
      document.getElementById('bpm-display').textContent = window.bpm;
      document.getElementById('steps-display').textContent = window.numSteps;

      // 3. Restore Channels
      const savedChannels = JSON.parse(fullBeat.channelInstancesJson);
      window.channelInstances.length = 0;
      savedChannels.forEach((ch, i) => {
        let def = INGREDIENT_DEFS.find(d => d.name === ch.name);
        if (!def) {
          def = { name: ch.name, color: ch.color};
          INGREDIENT_DEFS.push(def);
        }
        window.channelInstances.push({ def, instanceNum: ch.instanceNum, id: i });
      });

      nextId = Math.max(0, ...window.channelInstances.map(c => c.id || 0)) + 1;

      // 4. Restore Patterns
      const parsedPatterns = JSON.parse(fullBeat.patternsJson);
      window.patterns.length = 0;
      parsedPatterns.forEach(p => window.patterns.push(p));

      window.activePat = 0;

      // 5. Restore Volumes & Muted
      volumes.length = 0;
      muted.length = 0;
      for (let i = 0; i < window.channelInstances.length; i++) {
        volumes.push(0.75);
        muted.push(false);
      }

      // 6. Rerender UI
      if (typeof GeminiSuggest !== 'undefined') GeminiSuggest.clearSuggestions();
      renderShelf();
      renderRack();
      renderPatterns();
      if (typeof updateStatus === 'function') updateStatus();

      UI.closeBeatHistory();
      element.innerHTML = origHtml;

    } catch (e) {
      console.error("Failed to load beat:", e);
      alert("Failed to load beat: " + e.message);
      element.innerHTML = origHtml;
    }
  },

  // ── Roll history modal ────────────────────────────────────
  async openHistory() {
    if (!Auth.isLoggedIn()) {
      if(confirm('You need to log in to see your roll history. Go to login screen?')) {
        window.location.href = 'login.html';
      }
      return;
    }
    const overlay = document.getElementById('history-overlay');
    const body    = document.getElementById('history-body');
    if (!overlay) return;
    overlay.style.display = 'flex';
    body.innerHTML = '<div class="history-loading">loading...</div>';

    try {
      const rolls = await DB.listRolls();
      if (!rolls.length) {
        body.innerHTML = '<div class="history-empty">no rolls yet!<br>make some music 🍣</div>';
        return;
      }
      body.innerHTML = '';
      rolls.forEach(roll => {
        const card = document.createElement('div');
        card.className = 'history-card';

        const stars = '★'.repeat(roll.rating) + '☆'.repeat(5 - roll.rating);
        const date  = new Date(roll.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' });
        const ings  = (roll.ingredients || []).slice(0, 5).join(', ');

        card.innerHTML = `
          <div class="hc-left">
            ${roll.canvasDataUrl
              ? `<img class="hc-thumb" src="${roll.canvasDataUrl}" alt="sushi roll"/>`
              : `<div class="hc-thumb hc-thumb-placeholder">🍣</div>`}
          </div>
          <div class="hc-info">
            <div class="hc-name">${roll.rollName}</div>
            <div class="hc-rating" title="${roll.ratingLabel}">${stars}</div>
            <div class="hc-label">${roll.ratingLabel}</div>
            <div class="hc-ings">${ings}</div>
            <div class="hc-date">${date}</div>
          </div>
          <button class="hc-delete" onclick="UI._deleteRoll('${roll.id}', this)" title="delete">✕</button>
        `;
        body.appendChild(card);
      });
    } catch (e) {
      body.innerHTML = `<div class="history-empty">error loading rolls<br><small>${e.message}</small></div>`;
    }
  },

  closeHistory(e) {
    const overlay = document.getElementById('history-overlay');
    if (e && e.target !== overlay) return;
    if (overlay) overlay.style.display = 'none';
  },

  async _deleteRoll(id, btn) {
    btn.textContent = '⏳';
    btn.disabled = true;
    await DB.deleteRoll(id);
    btn.closest('.history-card').remove();
    const body = document.getElementById('history-body');
    if (!body.querySelector('.history-card')) {
      body.innerHTML = '<div class="history-empty">no rolls yet!<br>make some music 🍣</div>';
    }
  }
});

// EXPOSE UI and App to global scope
window.UI = UI;
window.App = App;