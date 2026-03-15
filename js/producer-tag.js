/*
  producer-tag.js — ElevenLabs producer tag for SushiDAW
  Handles customizable tag text, voice selection, and triggers.
*/

const ProducerTag = (() => {
  const STORAGE_KEY = 'sushidaw_producer_tag_settings';

  const VOICES = [
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'chief adam',    style: 'calm & warm'    },
    { id: '5F6a8n4ijdCrImoXgxM9', name: 'dj danny',      style: 'energetic'      },
    { id: 'cENJycK4Wg62xVikqkaA', name: 'sashyummy',   style: 'smooth & cool'  },
    { id: 'T7eLpgAAhoXHlrNajG8v', name: 'julia beatz',  style: 'deep & rich'    },
  ];

  let settings = {
    enabled:       true,
    producerName:  '',
    tagTemplate:   'a {name} production.',
    voiceId:       VOICES[0].id,
    playOn:        'finish',
    cachedAudio:   null,
    cachedFor:     ''
  };

  let audioEl = null;
  let isGenerating = false;

  const getElevenLabsKey = () => (window.ENV && window.ENV.ELEVENLABS_KEY ? window.ENV.ELEVENLABS_KEY : '');

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(settings, JSON.parse(raw));

      // Default to the logged-in user's name if no custom name is set
      if (!settings.producerName && typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
        settings.producerName = Auth.getUser().producerTag || Auth.getUser().username;
      }
    } catch { /* ignore */ }
  }

  function save() {
    const { cachedAudio, ...rest } = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  }

  async function generate() {
    const key  = getElevenLabsKey();
    const name = settings.producerName?.trim();
    const template = settings.tagTemplate || 'A {name} production.';

    if (!key) throw new Error("ElevenLabs key missing from env.js");
    if (!name) throw new Error("Name is missing");

    // Replace {name} placeholder with the actual name
    const text = template.replace('{name}', name);

    const cacheKey = `${text}::${settings.voiceId}`;
    if (settings.cachedFor === cacheKey && settings.cachedAudio) {
      return settings.cachedAudio;
    }

    isGenerating = true;

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
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.8 }
          })
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail?.message || `API Error ${res.status}`);
      }

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

  function openPanel() {
    load();
    const existing = document.getElementById('tag-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.id = 'tag-panel';
    panel.className = 'tag-panel';

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

        <label class="tag-label">tag text (use {name} for your name)</label>
        <input id="tp-template" class="settings-input" type="text"
          placeholder="A {name} production." value="${settings.tagTemplate || 'A {name} production.'}"
          style="width:100%;margin-bottom:10px"/>

        <label class="tag-label">voice</label>
        <div class="tag-voices" id="tp-voices">
          ${VOICES.map(v => `
            <div class="tag-voice ${v.id === settings.voiceId ? 'active' : ''}"
                 data-id="${v.id}" onclick="ProducerTag._selectVoice('${v.id}')">
              <span class="tag-voice-name">${v.name}</span>
            </div>`).join('')}
        </div>

        <label class="tag-label" style="margin-top:10px">play on</label>
        <div class="tag-play-opts">
           <button class="tag-opt-btn ${settings.playOn === 'play' ? 'active' : ''}" onclick="ProducerTag._setPlayOn('play')">▶ play</button>
           <button class="tag-opt-btn ${settings.playOn === 'finish' ? 'active' : ''}" onclick="ProducerTag._setPlayOn('finish')">🍱 finish</button>
           <button class="tag-opt-btn ${settings.playOn === 'both' ? 'active' : ''}" onclick="ProducerTag._setPlayOn('both')">both</button>
        </div>

        <div class="tag-actions" style="margin-top:14px;display:flex;gap:8px;">
          <button class="pill accent" id="tp-preview" onclick="ProducerTag._preview()">▶ preview</button>
          <button class="pill" onclick="ProducerTag._save()">save</button>
        </div>
        <div id="tp-status" class="tag-status" style="margin-top:8px;"></div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  function _save() {
    settings.producerName = document.getElementById('tp-name').value.trim();
    settings.tagTemplate  = document.getElementById('tp-template').value.trim();
    settings.cachedAudio  = null;
    save();
    document.getElementById('tp-status').textContent = '✓ saved!';
  }

  async function _preview() {
    settings.producerName = document.getElementById('tp-name').value.trim();
    settings.tagTemplate  = document.getElementById('tp-template').value.trim();
    settings.cachedAudio  = null;

    const status = document.getElementById('tp-status');
    try {
      await play();
      status.textContent = '✓ played!';
    } catch (e) {
      status.textContent = '⚠ ' + e.message;
    }
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
    document.querySelectorAll('.tag-play-opts .tag-opt-btn').forEach(el => {
      el.classList.toggle('active', el.getAttribute('onclick').includes(`'${val}'`));
    });
  }

  load();

  // Public API triggers for the DAW playback and finish events
  return {
    onPlay: () => (settings.playOn === 'play' || settings.playOn === 'both') && play(),
    onFinish: () => (settings.playOn === 'finish' || settings.playOn === 'both') && play(),
    openPanel, _selectVoice, _setPlayOn, _preview, _save
  };
})();