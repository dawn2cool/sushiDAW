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
    playOn:        'finish', // 'play', 'finish', or 'both'
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
    // Call the local Vercel proxy instead of ElevenLabs directly
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

  function openPanel() {
    load();
    const existing = document.getElementById('tag-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.id = 'tag-panel';
    panel.className = 'tag-panel';
    panel.innerHTML = `
      <div class="tag-panel-header">
        <span>🎙 producer tag</span>
        <button onclick="document.getElementById('tag-panel').remove()">✕</button>
      </div>
      <div class="tag-panel-body">
        <label>your name</label>
        <input id="tp-name" type="text" value="${settings.producerName || ''}">
        <label>tag text ({name} = name)</label>
        <input id="tp-template" type="text" value="${settings.tagTemplate}">
        <label>voice</label>
        <div class="tag-voices">
          ${VOICES.map(v => `<div class="tag-voice ${v.id === settings.voiceId ? 'active' : ''}" onclick="ProducerTag._selectVoice('${v.id}')">${v.name}</div>`).join('')}
        </div>
        <label>play on</label>
        <div class="tag-play-opts">
           <button class="${settings.playOn === 'play' ? 'active' : ''}" onclick="ProducerTag._setPlayOn('play')">▶ start</button>
           <button class="${settings.playOn === 'finish' ? 'active' : ''}" onclick="ProducerTag._setPlayOn('finish')">🍱 finish</button>
           <button class="${settings.playOn === 'both' ? 'active' : ''}" onclick="ProducerTag._setPlayOn('both')">both</button>
        </div>
        <div style="display:flex; gap:8px; margin-top:12px">
          <button class="pill accent" onclick="ProducerTag._preview()">▶ preview</button>
          <button class="pill" onclick="ProducerTag._save()">save</button>
        </div>
        <div id="tp-status"></div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  return {
    onPlay: () => (settings.playOn === 'play' || settings.playOn === 'both') && play(),
    onFinish: () => (settings.playOn === 'finish' || settings.playOn === 'both') && play(),
    play,
    openPanel,
    _save: () => {
      settings.producerName = document.getElementById('tp-name').value;
      settings.tagTemplate = document.getElementById('tp-template').value;
      settings.cachedAudio = null;
      save();
      document.getElementById('tp-status').textContent = '✓ saved';
    },
    _preview: play,
    _selectVoice: (id) => {
      settings.voiceId = id;
      settings.cachedAudio = null;
      ProducerTag.openPanel(); // re-render
    },
    _setPlayOn: (val) => {
      settings.playOn = val;
      ProducerTag.openPanel(); // re-render
    }
  };
})();
window.ProducerTag = ProducerTag;