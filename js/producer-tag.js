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
    playOn:        'finish', // 'play', 'finish', or 'both'
    cachedAudio:   null,
    cachedFor:     ''
  };

  let audioEl = null;
  let isGenerating = false;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(settings, JSON.parse(raw));

      if (!settings.producerName && typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
        const user = Auth.getUser();
        settings.producerName = user.producerTag || user.username;
      }
    } catch { /* ignore */ }
  }

  function save() {
    const { cachedAudio, ...rest } = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  }

  async function generate() {
    const name = settings.producerName?.trim();
    const template = settings.tagTemplate || 'A {name} production.';

    if (!name) return null;

    const text = template.replace('{name}', name);
    const cacheKey = `${text}::${settings.voiceId}`;

    if (settings.cachedFor === cacheKey && settings.cachedAudio) {
      return settings.cachedAudio;
    }

    if (isGenerating) return null;
    isGenerating = true;

    try {
      // Calls the secure TTS proxy
      const res = await fetch(`/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: settings.voiceId, text: text })
      });

      if (!res.ok) throw new Error("Proxy Error");

      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          settings.cachedAudio = reader.result;
          settings.cachedFor = cacheKey;
          resolve(reader.result);
        };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      isGenerating = false;
    }
  }

  async function play() {
    if (!settings.enabled || !settings.producerName) return;
    const audioData = await generate();
    if (!audioData) return;

    if (!audioEl) {
      audioEl = document.createElement('audio');
      document.body.appendChild(audioEl);
    }
    audioEl.src = audioData;
    audioEl.volume = 0.8;
    audioEl.play().catch(e => console.warn("Playback blocked or failed", e));
  }

  function updateUIState() {
    const panel = document.getElementById('tag-panel');
    if (!panel) return;

    // Update Voice selection
    panel.querySelectorAll('.tag-voice').forEach(el => {
      el.classList.toggle('active', el.dataset.id === settings.voiceId);
    });

    // Update Play On selection
    panel.querySelectorAll('.tag-play-opts button').forEach(el => {
      el.classList.toggle('active', el.dataset.val === settings.playOn);
    });

    // Update Enable/Disable button
    const toggleBtn = document.getElementById('tp-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = settings.enabled ? '✅ enabled' : '❌ disabled';
        toggleBtn.classList.toggle('active', settings.enabled);
    }
  }

  function openPanel() {
    load();
    let panel = document.getElementById('tag-panel');
    
    if (panel) {
      updateUIState();
      return;
    }

    panel = document.createElement('div');
    panel.id = 'tag-panel';
    panel.className = 'tag-panel';
    panel.innerHTML = `
      <div class="tag-panel-header">
        <span>🎙 producer tag</span>
        <button onclick="document.getElementById('tag-panel').remove()">✕</button>
      </div>
      <div class="tag-panel-body">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <label style="margin:0;">status</label>
            <button id="tp-toggle" class="pill" onclick="ProducerTag._toggleEnabled()">
                ${settings.enabled ? '✅ enabled' : '❌ disabled'}
            </button>
        </div>

        <label>your name</label>
        <input id="tp-name" type="text" value="${settings.producerName || ''}">
        
        <label>tag text ({name} = name)</label>
        <input id="tp-template" type="text" value="${settings.tagTemplate}">
        
        <label>voice</label>
        <div class="tag-voices">
          ${VOICES.map(v => `
            <div class="tag-voice ${v.id === settings.voiceId ? 'active' : ''}" 
                 data-id="${v.id}"
                 onclick="ProducerTag._selectVoice('${v.id}')">
              ${v.name}
            </div>`).join('')}
        </div>
        
        <label>play on</label>
        <div class="tag-play-opts">
           <button class="pill ${settings.playOn === 'play' ? 'active' : ''}" 
                   data-val="play" 
                   onclick="ProducerTag._setPlayOn('play')">▶ start</button>
           <button class="pill ${settings.playOn === 'finish' ? 'active' : ''}" 
                   data-val="finish" 
                   onclick="ProducerTag._setPlayOn('finish')">🍱 finish</button>
           <button class="pill ${settings.playOn === 'both' ? 'active' : ''}" 
                   data-val="both" 
                   onclick="ProducerTag._setPlayOn('both')">both</button>
        </div>
        
        <div style="display:flex; gap:8px; margin-top:16px">
          <button class="pill accent" onclick="ProducerTag._preview()">▶ preview</button>
          <button class="pill" onclick="ProducerTag._save()">save settings</button>
        </div>
        <div id="tp-status" style="margin-top:8px; font-size:12px; color:var(--accent)"></div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  return {
    load,
    onPlay: () => (settings.playOn === 'play' || settings.playOn === 'both') && play(),
    onFinish: () => (settings.playOn === 'finish' || settings.playOn === 'both') && play(),
    play,
    openPanel,
    _toggleEnabled: () => {
        settings.enabled = !settings.enabled;
        updateUIState();
    },
    _save: () => {
      settings.producerName = document.getElementById('tp-name').value;
      settings.tagTemplate = document.getElementById('tp-template').value;
      settings.cachedAudio = null;
      save();
      const status = document.getElementById('tp-status');
      status.textContent = '✓ saved';
      setTimeout(() => { if(status) status.textContent = ''; }, 2000);
    },
    _preview: () => {
      settings.producerName = document.getElementById('tp-name').value;
      settings.tagTemplate = document.getElementById('tp-template').value;
      play();
    },
    _selectVoice: (id) => {
      settings.voiceId = id;
      settings.cachedAudio = null;
      updateUIState();
    },
    _setPlayOn: (val) => {
      settings.playOn = val;
      updateUIState();
    }
  };
})();
window.ProducerTag = ProducerTag;