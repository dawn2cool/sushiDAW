/*
  gemini.js — Background rhythm suggestion engine.

  How it works:
  - Listens for grid changes via GeminiSuggest.notify()
  - After 2.5s of inactivity with ≥4 active cells, silently calls Gemini
  - Returns {row, step} pairs which App renders as ghost cells
  - No visible AI button. Only the status strip sparkle (✦) hints it ran.
  - User clicks a ghost to accept it as a real beat.
  - Ghosts auto-expire after 9 seconds.
*/

const GeminiSuggest = (() => {
  let debounceTimer = null;
  let expireTimer   = null;
  let lastHash      = '';
  let suggestions   = [];  // [{row, step}]
  let onSuggest     = null; // callback(suggestions)
  let onClear       = null; // callback()
  let running       = false;

  const DEBOUNCE_MS  = 2500;
  const EXPIRE_MS    = 9000;
  const MIN_ACTIVE   = 4;

  function getKey() {
    return (document.getElementById('gemini-key')?.value || '').trim();
  }

  function hashGrid(grid, numSteps) {
    return grid.map(row => row.slice(0, numSteps).map(v => v ? '1' : '0').join('')).join('|');
  }

  function countActive(grid, numSteps) {
    return grid.reduce((sum, row) => sum + row.slice(0, numSteps).filter(Boolean).length, 0);
  }

  // Called by App whenever the grid changes
  function notify(grid, numSteps) {
    clearTimeout(debounceTimer);
    const key = getKey();
    if (!key) return;
    if (countActive(grid, numSteps) < MIN_ACTIVE) return;

    const h = hashGrid(grid, numSteps);
    if (h === lastHash) return;

    debounceTimer = setTimeout(() => fetchSuggestions(grid, numSteps, h, key), DEBOUNCE_MS);
  }

  async function fetchSuggestions(grid, numSteps, hash, key) {
    if (running) return;
    running = true;

    const CH_NAMES = ['Rice','Salmon','Tuna','Avocado','Cucumber','Egg','Prawn','Seaweed'];

    const currentPatternObj = {};
    CH_NAMES.forEach((name, i) => {
      currentPatternObj[name] = grid[i].slice(0, numSteps);
    });

    const systemInstruction = `You are a subtle rhythmic advisor embedded in a sushi step sequencer.
Channel roles (think of them as percussion/melodic elements):
Rice=kick drum, Salmon=snare, Tuna=hi-hat, Avocado=sub bass, Cucumber=bass line, Egg=mid-range, Prawn=accent/rimshot, Seaweed=texture/shimmer.

Given the current beat pattern, suggest 3 to 7 additional cells that would improve the rhythm musically.
Consider swing, syncopation, ghost notes, and complementary rhythms.
Do NOT suggest cells that are already active.

Respond ONLY with valid JSON, no markdown, no explanation:
{"suggestions":[{"row":0,"step":3},{"row":2,"step":7}],"bpm_hint":128}

Row indices: Rice=0, Salmon=1, Tuna=2, Avocado=3, Cucumber=4, Egg=5, Prawn=6, Seaweed=7.
Step indices are 0-based.`;

    const userMessage = `Current pattern (${numSteps} steps): ${JSON.stringify(currentPatternObj)}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userMessage }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.75, maxOutputTokens: 400 }
          })
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data  = await res.json();
      const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      // Filter out suggestions for already-active cells
      suggestions = (parsed.suggestions || []).filter(s => {
        const r = Number(s.row); const st = Number(s.step);
        return r >= 0 && r < 8 && st >= 0 && st < numSteps && !grid[r][st];
      });

      lastHash = hash;

      if (suggestions.length > 0) {
        onSuggest?.(suggestions, parsed.bpm_hint);
        // Auto-expire
        clearTimeout(expireTimer);
        expireTimer = setTimeout(() => {
          suggestions = [];
          onClear?.();
        }, EXPIRE_MS);
      }
    } catch (_e) {
      // Fail silently — background feature shouldn't surface errors to UI
    } finally {
      running = false;
    }
  }

  function acceptSuggestion(row, step) {
    suggestions = suggestions.filter(s => !(s.row === row && s.step === step));
    if (suggestions.length === 0) onClear?.();
  }

  function clearSuggestions() {
    suggestions = [];
    clearTimeout(expireTimer);
    onClear?.();
  }

  function getSuggestions() { return suggestions; }

  function onUpdate(suggestCb, clearCb) {
    onSuggest = suggestCb;
    onClear   = clearCb;
  }

  async function generateIngredient(description) {
    if (!description) return;
    const key = getKey();
    if (!key) {
      alert("Please enter a Gemini API Key in settings first!");
      return;
    }

    const systemInstruction = `You are a molecular gastronomy sound designer.
    The user wants to add "${description}" to their sushi DAW.
    1. Validate if it is a food/ingredient.
    2. If valid, suggest Web Audio synth parameters based on flavor profile and texture:
       freq (number 20-2000),
       wave (string: 'sine', 'square', 'sawtooth', or 'triangle'),
       decay (number 0.05-0.8),
       gain (0.5),
       filter (object with 'type': 'lowpass'|'highpass'|'bandpass' and 'freq': 200-5000).
    Respond ONLY with valid JSON, no markdown:
    {"valid": true, "color": "#HEXCODE", "synth": {"freq": 440, "wave": "sine", "decay": 0.2, "gain": 0.5, "filter": {"type": "lowpass", "freq": 1000}}}`;

    const userMessage = `Create a sound for the ingredient: ${description}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userMessage }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
          })
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (parsed.valid) {
        // 1. Register the new sound in the audio engine
        const newIdx = Audio.addDynamicVoice(parsed.synth);

        // 2. Add to the palette (using the new index to ensure audio.js plays the right sound)
        INGREDIENT_DEFS.push({
          name: description.toLowerCase(),
          color: parsed.color,
          defCount: 1,
          voiceIdx: newIdx // Store reference to the custom voice
        });

        // 3. Refresh UI
        if (typeof renderShelf === 'function') renderShelf();
        console.log(`Added AI Ingredient: ${description}`, parsed);
      } else {
        alert(`"${description}" doesn't seem like a sushi ingredient!`);
      }
    } catch (err) {
      console.error("Failed to generate ingredient:", err);
      alert("Error connecting to Gemini. Check your key and console.");
    }
  }

  return { notify, onUpdate, acceptSuggestion, clearSuggestions, getSuggestions, generateIngredient};
})();