/*
  producer-tag.js — ElevenLabs producer tag for SushiDAW
  Generates a personalised "a [name] production" voice tag.
*/

const ProducerTag = (() => {
  const STORAGE_KEY = 'sushidaw_producer_tag_settings';

  const VOICES = [
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Chef Adam',    style: 'calm & warm'    },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'DJ Domi',      style: 'energetic'      },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Miso Sarah',   style: 'smooth & cool'  },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Nori Arnold',  style: 'deep & rich'    },
  ];

  let settings = {
    enabled:       true,
    producerName:  '',
    voiceId:       VOICES[0].id,
    playOn:        'finish',   // 'play' | 'finish' | 'both'
    cachedAudio:   null,
    cachedFor:     ''
  };

  let audioEl = null;
  let isGenerating = false;

  // Pull key from env.js
  const getElevenLabsKey = () => (typeof ENV !== 'undefined' ? ENV.ELEVENLABS_KEY : '');

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(settings, JSON.parse(raw));
      if (!settings.producerName && typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
        settings.producerName = Auth.getUser().producerTag || Auth.getUser().username;
      }
    } catch { /* ignore */ }
  }

  function save() {
    const { cachedAudio, ...rest } = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  }

  // ── Generate or play the tag ──────────────────────────────

  async function generate() {
    const key  = getElevenLabsKey();
    const name = settings.producerName?.trim();

    if (!key) {
      console.warn("ElevenLabs key missing from env.js");
      return null;
    }
    if (!name) return null;

    const cacheKey = `${name}::${settings.voiceId}`;
    if (settings.cachedFor === cacheKey && settings.cachedAudio) {
      return settings.cachedAudio;
    }

    isGenerating = true;
    const text = `A ${name} production.`;

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${settings.voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': key,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: { stability: 0.5, similarity_boost: 0.8 }
          })
        }
      );

      if (!res.ok) throw new Error(`ElevenLabs error ${res.status}`);

      const blob = await res.blob();
      const reader = new FileReader();
      return await new Promise((resolve, reject) => {
        reader.onload = () => {
          settings.cachedAudio = reader.result;
          settings.cachedFor   = cacheKey;
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('ProducerTag generate error:', e);
      return null;
    } finally {
      isGenerating = false;
    }
  }

  async function play() {
    if (!settings.enabled || !settings.producerName || !getElevenLabsKey()) return;
    const audio = await generate();
    if (!audio) return;

    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
    }
    audioEl.src    = audio;
    audioEl.volume = 0.85;
    await audioEl.play().catch(() => {});
  }

  function onPlay() {
    if (settings.playOn === 'play' || settings.playOn === 'both') play();
  }

  function onFinish() {
    if (settings.playOn === 'finish' || settings.playOn === 'both') play();
  }

  // ── Settings panel ────────────────────────────────────────

  function openPanel() {
    load();
    const existing = document.getElementById('tag-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.id = 'tag-panel';
    panel.className = 'tag-panel';

    // UI clean up: removed the API key input block entirely
    panel.innerHTML = `
      <div class="tag-panel-header">
        <span class="tag-panel-title">🎙 producer tag</span>
        <button class="tag-panel-close" onclick="document.getElementById('tag-panel').remove()">✕</button>
      </div>
      <div class="tag-panel-body">

        <label class="tag-label">your name</label>
        <input id="tp-name" class="settings-input" type="text"
          placeholder="e.g. DJ Salmon" value="${settings.producerName || ''}"
          style="width:100%;margin-bottom:10px"/>

        <label class="tag-label">voice</label>
        <div class="tag-voices" id="tp-voices">
          ${VOICES.map(v => `
            <div class="tag-voice ${v.id === settings.voiceId ? 'active' : ''}"
                 data-id="${v.id}" onclick="ProducerTag._selectVoice('${v.id}')">
              <span class="tag-voice-name">${v.name}</span>
              <span class="tag-voice-style">${v.style}</span>
            </div>`).join('')}
        </div>

        <label class="tag-label" style="margin-top:10px">play on</label>
        <div class="tag-play-opts">
          ${[['play','▶ play start'],['finish','🍱 finish roll'],['both','both']].map(([val, label]) => `
            <button class="tag-opt-btn ${settings.playOn === val ? 'active' : ''}"
                    onclick="ProducerTag._setPlayOn('${val}')">${label}</button>`).join('')}
        </div>

        <label class="tag-label" style="margin-top:12px">enabled</label>
        <button id="tp-toggle" class="tag-opt-btn ${settings.enabled ? 'active' : ''}"
                onclick="ProducerTag._toggleEnabled()">
          ${settings.enabled ? '✓ on' : 'off'}
        </button>

        <div class="tag-actions" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="pill accent" id="tp-preview" onclick="ProducerTag._preview()">▶ preview</button>
          <button class="pill" onclick="ProducerTag._save()">save</button>
        </div>
        <div id="tp-status" class="tag-status"></div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  function _selectVoice(id) {
    settings.voiceId = id;
    settings.cachedAudio = null;
    document.querySelectorAll('.tag-voice').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
  }

  function _setPlayOn(val) {
    settings.playOn = val;
    document.querySelectorAll('.tag-opt-btn').forEach(el => {
      if (['play','finish','both'].includes(el.textContent.trim().replace('▶ ','').replace('🍱 ','').replace(' start','').replace(' roll',''))) return;
    });
    document.querySelectorAll('.tag-play-opts .tag-opt-btn').forEach(el => {
      el.classList.toggle('active', el.textContent.trim().includes(val) || el.getAttribute('onclick')?.includes(`'${val}'`));
    });
  }

  function _toggleEnabled() {
    settings.enabled = !settings.enabled;
    const btn = document.getElementById('tp-toggle');
    if (btn) { btn.classList.toggle('active', settings.enabled); btn.textContent = settings.enabled ? '✓ on' : 'off'; }
  }

  async function _preview() {
    const nameEl = document.getElementById('tp-name');
    const status = document.getElementById('tp-status');
    const btn    = document.getElementById('tp-preview');

    settings.producerName = nameEl?.value?.trim() || settings.producerName;
    settings.cachedAudio  = null;

    if (!settings.producerName) { if (status) status.textContent = '⚠ enter your name first'; return; }
    if (!getElevenLabsKey()) { if (status) status.textContent = '⚠ setup env.js first'; return; }

    if (btn) { btn.textContent = '⏳ generating...'; btn.disabled = true; }
    if (status) status.textContent = '';

    await play();

    if (btn) { btn.textContent = '▶ preview'; btn.disabled = false; }
    if (status && !isGenerating) status.textContent = '✓ played!';
  }

  function _save() {
    const nameEl = document.getElementById('tp-name');
    settings.producerName = nameEl?.value?.trim() || settings.producerName;
    settings.cachedAudio  = null;
    save();

    if (typeof Auth !== 'undefined' && Auth.isLoggedIn() && settings.producerName) {
      Auth.updateProducerTag(settings.producerName).catch(() => {});
    }

    const status = document.getElementById('tp-status');
    if (status) { status.textContent = '✓ saved!'; setTimeout(() => { status.textContent = ''; }, 2000); }
  }

  load();
  return { play, onPlay, onFinish, openPanel, _selectVoice, _setPlayOn, _toggleEnabled, _preview, _save, load };
})();