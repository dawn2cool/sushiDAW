/*
  producer-tag.js — SushiDAW

  Timing modes:
    'play'   → tag plays first, beat starts only after audio ends
    'finish' → tag plays first, roll animation starts only after audio ends
    'both'   → both of the above
*/

const ProducerTag = (() => {
  const STORAGE_KEY = 'sushidaw_producer_tag_settings';

  const VOICES = [
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'chief adam',  style: 'calm & warm'   },
    { id: '5F6a8n4ijdCrImoXgxM9', name: 'dj danny',    style: 'energetic'     },
    { id: 'cENJycK4Wg62xVikqkaA', name: 'sashyummy',   style: 'smooth & cool' },
    { id: 'T7eLpgAAhoXHlrNajG8v', name: 'julia beatz', style: 'deep & rich'   },
  ];

  let settings = {
    enabled:      true,
    producerName: '',
    tagTemplate:  'a {name} production.',
    voiceId:      VOICES[0].id,
    playOn:       'finish',   // 'play' | 'finish' | 'both'
    cachedAudio:  null,
    cachedFor:    ''
  };

  let audioEl       = null;
  let isGenerating  = false;
  let prefetchDone  = false;

  // ── Persistence ─────────────────────────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(settings, JSON.parse(raw));
      // Sync name from auth if blank
      if (!settings.producerName &&
          typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
        const u = Auth.getUser();
        settings.producerName = u.producerTag || u.username || '';
      }
    } catch { /* ignore */ }
  }

  function save() {
    const { cachedAudio, ...rest } = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  }

  // ── Audio generation ─────────────────────────────────────────

  async function generate() {
    const name = settings.producerName?.trim();
    if (!name) return null;

    const text     = (settings.tagTemplate || 'a {name} production.').replace('{name}', name);
    const cacheKey = `${text}::${settings.voiceId}`;

    if (settings.cachedFor === cacheKey && settings.cachedAudio) {
      return settings.cachedAudio;
    }

    // Only one generation at a time
    if (isGenerating) {
      // Wait for it to finish then try cache again
      await new Promise(r => setTimeout(r, 3500));
      if (settings.cachedFor === cacheKey && settings.cachedAudio) return settings.cachedAudio;
      return null;
    }

    isGenerating = true;
    setStatus('generating tag…');

    try {
      const res = await fetch('/api/tts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ voiceId: settings.voiceId, text })
      });

      if (!res.ok) throw new Error(`TTS proxy ${res.status}`);

      const blob = await res.blob();
      return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => {
          settings.cachedAudio = reader.result;
          settings.cachedFor   = cacheKey;
          prefetchDone         = true;
          setStatus('');
          resolve(reader.result);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('ProducerTag generate:', e);
      setStatus('⚠ tag failed');
      setTimeout(() => setStatus(''), 3000);
      return null;
    } finally {
      isGenerating = false;
    }
  }

  // ── Playback — returns a Promise that resolves when audio ENDS ──

  function playAndWait() {
    if (!settings.enabled || !settings.producerName?.trim()) {
      return Promise.resolve();
    }

    return generate().then(audioData => {
      if (!audioData) return;

      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
      }

      audioEl.src    = audioData;
      audioEl.volume = 0.85;

      return new Promise(resolve => {
        // Resolve when audio ends, errors out, or is blocked
        const done = () => {
          audioEl.onended  = null;
          audioEl.onerror  = null;
          resolve();
        };
        audioEl.onended = done;
        audioEl.onerror = done;

        const playPromise = audioEl.play();
        if (playPromise) {
          playPromise.catch(() => {
            // Autoplay blocked (e.g. no prior user gesture) — don't hold up the beat
            console.warn('ProducerTag: autoplay blocked, skipping tag');
            resolve();
          });
        }
      });
    });
  }

  // ── Prefetch in background ────────────────────────────────────
  // Call this after settings are saved so the audio is ready instantly
  function prefetch() {
    if (settings.enabled && settings.producerName?.trim()) {
      generate().catch(() => {});
    }
  }

  // ── Public hooks — callers must await these ───────────────────

  // onPlay — fires at step 0 over the beat, fire-and-forget (no blocking)
  function onPlay() {
    if (!settings.enabled) return;
    if (settings.playOn === 'play' || settings.playOn === 'both') {
      playAndWait(); // intentionally NOT awaited — plays over the beat
    }
  }

  // onFinish — blocks the roll animation until the tag finishes speaking
  function onFinish() {
    if (!settings.enabled) return Promise.resolve();
    if (settings.playOn === 'finish' || settings.playOn === 'both') {
      return playAndWait();
    }
    return Promise.resolve();
  }

  // ── Panel helpers ─────────────────────────────────────────────

  function setStatus(msg) {
    const el = document.getElementById('tp-status');
    if (el) el.textContent = msg;
  }

  function updateUIState() {
    const panel = document.getElementById('tag-panel');
    if (!panel) return;

    panel.querySelectorAll('.tag-voice').forEach(el =>
      el.classList.toggle('active', el.dataset.id === settings.voiceId)
    );
    panel.querySelectorAll('.tag-play-opts button').forEach(el =>
      el.classList.toggle('active', el.dataset.val === settings.playOn)
    );
    const toggleBtn = document.getElementById('tp-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = settings.enabled ? '✅ enabled' : '❌ disabled';
      toggleBtn.classList.toggle('active', settings.enabled);
    }
    // Show cache state
    const cacheEl = document.getElementById('tp-cache');
    if (cacheEl) cacheEl.textContent = prefetchDone ? '✓ audio ready' : '';
  }

  function openPanel() {
    load();
    let panel = document.getElementById('tag-panel');
    if (panel) { updateUIState(); return; }

    panel = document.createElement('div');
    panel.id        = 'tag-panel';
    panel.className = 'tag-panel';
    panel.innerHTML = `
      <div class="tag-panel-header">
        <span class="tag-panel-title">🎙 producer tag</span>
        <button class="tag-panel-close" onclick="document.getElementById('tag-panel').remove()">✕</button>
      </div>
      <div class="tag-panel-body">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <label class="tag-label" style="margin:0">status</label>
          <button id="tp-toggle" class="pill tag-opt-btn ${settings.enabled ? 'active' : ''}"
                  onclick="ProducerTag._toggleEnabled()">
            ${settings.enabled ? '✅ enabled' : '❌ disabled'}
          </button>
        </div>

        <label class="tag-label">your name</label>
        <input id="tp-name" class="settings-input" type="text"
               value="${settings.producerName || ''}"
               placeholder="e.g. DJ Salmon"
               style="width:100%;margin-bottom:10px"/>

        <label class="tag-label">tag text</label>
        <input id="tp-template" class="settings-input" type="text"
               value="${settings.tagTemplate}"
               placeholder="a {name} production."
               style="width:100%;margin-bottom:10px"/>
        <span style="font-family:var(--font-pixel);font-size:5px;color:var(--ink3);display:block;margin-bottom:12px">
          {name} is replaced with your name
        </span>

        <label class="tag-label">voice</label>
        <div class="tag-voices">
          ${VOICES.map(v => `
            <div class="tag-voice ${v.id === settings.voiceId ? 'active' : ''}"
                 data-id="${v.id}" onclick="ProducerTag._selectVoice('${v.id}')">
              <span class="tag-voice-name">${v.name}</span>
              <span class="tag-voice-style">${v.style}</span>
            </div>`).join('')}
        </div>

        <label class="tag-label" style="margin-top:12px">play on</label>
        <div style="font-family:var(--font-pixel);font-size:5px;color:var(--ink3);margin-bottom:6px;line-height:1.8">
          beat starts / roll animates only AFTER tag finishes speaking
        </div>
        <div class="tag-play-opts">
          <button class="pill tag-opt-btn ${settings.playOn === 'play'   ? 'active' : ''}"
                  data-val="play"   onclick="ProducerTag._setPlayOn('play')">▶ play start</button>
          <button class="pill tag-opt-btn ${settings.playOn === 'finish' ? 'active' : ''}"
                  data-val="finish" onclick="ProducerTag._setPlayOn('finish')">🍱 finish roll</button>
          <button class="pill tag-opt-btn ${settings.playOn === 'both'   ? 'active' : ''}"
                  data-val="both"   onclick="ProducerTag._setPlayOn('both')">both</button>
        </div>

        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="pill accent" onclick="ProducerTag._preview()">▶ preview</button>
          <button class="pill"        onclick="ProducerTag._save()">save settings</button>
        </div>

        <div id="tp-status" class="tag-status"></div>
        <div id="tp-cache"  style="font-family:var(--font-pixel);font-size:5px;color:var(--ink3);margin-top:4px">
          ${prefetchDone ? '✓ audio ready' : ''}
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  // ── Exposed methods ───────────────────────────────────────────

  load();

  return {
    load,
    onPlay,
    onFinish,
    prefetch,
    openPanel,
    _toggleEnabled() {
      settings.enabled = !settings.enabled;
      updateUIState();
    },
    _save() {
      settings.producerName = document.getElementById('tp-name')?.value?.trim()    || '';
      settings.tagTemplate  = document.getElementById('tp-template')?.value?.trim() || 'a {name} production.';
      settings.cachedAudio  = null;   // bust cache — new name/template
      settings.cachedFor    = '';
      prefetchDone          = false;
      save();

      // Sync producer name to backend
      if (typeof Auth !== 'undefined' && Auth.isLoggedIn() && settings.producerName) {
        Auth.updateProducerTag(settings.producerName).catch(() => {});
      }

      // Prefetch so it's ready instantly next time
      prefetch();

      setStatus('✓ saved — generating audio…');
      setTimeout(() => setStatus(''), 3000);
    },
    async _preview() {
      settings.producerName = document.getElementById('tp-name')?.value?.trim()    || settings.producerName;
      settings.tagTemplate  = document.getElementById('tp-template')?.value?.trim() || settings.tagTemplate;
      settings.cachedAudio  = null;
      settings.cachedFor    = '';
      prefetchDone          = false;

      const btn = document.querySelector('.tag-panel .pill.accent');
      if (btn) { btn.textContent = '⏳ generating…'; btn.disabled = true; }

      await playAndWait();

      if (btn) { btn.textContent = '▶ preview'; btn.disabled = false; }
      updateUIState();
    },
    _selectVoice(id) {
      settings.voiceId     = id;
      settings.cachedAudio = null;
      settings.cachedFor   = '';
      prefetchDone         = false;
      updateUIState();
    },
    _setPlayOn(val) {
      settings.playOn = val;
      updateUIState();
    }
  };
})();

window.ProducerTag = ProducerTag;