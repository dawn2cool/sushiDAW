/* audio.js — Web Audio synthesis engine for SushiDAW */
const Audio = (() => {
  let ctx = null;

  // Each channel: frequency + timbre character
  const VOICES = [
    { freq: 80,    wave: 'sine',     decay: 0.18, gain: 0.7,  filter: { type: 'lowpass',  freq: 200  } }, // Rice    = kick
    { freq: 220,   wave: 'triangle', decay: 0.20, gain: 0.55, filter: { type: 'bandpass', freq: 400  } }, // Salmon  = snare body
    { freq: 1200,  wave: 'square',   decay: 0.08, gain: 0.35, filter: { type: 'highpass', freq: 800  } }, // Tuna    = hi-hat
    { freq: 110,   wave: 'sawtooth', decay: 0.28, gain: 0.5,  filter: { type: 'lowpass',  freq: 300  } }, // Avocado = bass 1
    { freq: 165,   wave: 'sawtooth', decay: 0.22, gain: 0.45, filter: { type: 'lowpass',  freq: 280  } }, // Cucumber= bass 2
    { freq: 440,   wave: 'triangle', decay: 0.16, gain: 0.5,  filter: { type: 'bandpass', freq: 600  } }, // Egg     = mid tom
    { freq: 660,   wave: 'square',   decay: 0.10, gain: 0.4,  filter: { type: 'bandpass', freq: 1000 } }, // Prawn   = accent
    { freq: 3200,  wave: 'sawtooth', decay: 0.06, gain: 0.28, filter: { type: 'highpass', freq: 2000 } }, // Seaweed = texture
  ];

  function init() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playNote(chIdx, time, volume = 1.0) {
    if (!ctx) return;
    const v = VOICES[chIdx];
    const vol = volume * v.gain;

    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    const filt  = ctx.createBiquadFilter();

    filt.type = v.filter.type;
    filt.frequency.value = v.filter.freq;
    filt.Q.value = v.wave === 'bandpass' ? 4 : 1.5;

    osc.type = v.wave;
    osc.frequency.setValueAtTime(v.freq, time);

    // Pitch envelope (kick-like drop for bass channels)
    if (chIdx === 0 || chIdx === 3 || chIdx === 4) {
      osc.frequency.exponentialRampToValueAtTime(v.freq * 0.3, time + v.decay * 0.6);
    }

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + v.decay);

    osc.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + v.decay + 0.05);
  }

  function currentTime() {
    return ctx ? ctx.currentTime : 0;
  }

  return {
      init,
      resume,
      playNote,
      currentTime,
      addDynamicVoice: (params) => {
        VOICES.push({
          freq: params.freq || 440,
          wave: params.wave || 'sine',
          decay: params.decay || 0.2,
          gain: params.gain || 0.5,
          filter: params.filter || { type: 'lowpass', freq: 1000 }
        });
        return VOICES.length - 1;
      }
    };
})();