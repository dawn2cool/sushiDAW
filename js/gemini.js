/**
 * gemini.js — SushiDAW Ingredient Creator
 * Uses Gemini API to validate food and generate synth parameters.
 */

const GeminiSuggest = (() => {
  // Pulls the key from the ENV object defined in env.js
  const getKey = () => (typeof ENV !== 'undefined' ? ENV.GEMINI_KEY : '');

  async function generateIngredient(description) {
    if (!description || !description.trim()) return;

    const key = getKey();
    if (!key) {
      alert('Gemini API Key not found. Please check env.js');
      return;
    }

    // UI Feedback: reference elements from index.html
    const btnEl = document.querySelector('.ai-create-btn');
    const inputField = document.getElementById('ai-ing-input');
    const origHTML = btnEl ? btnEl.innerHTML : '';

    if (btnEl) {
      btnEl.innerHTML = '<span>⏳</span> rolling...';
      btnEl.disabled = true;
    }

    const prompt = `You are a sound designer for a sushi music app.
The user wants to add "${description.trim()}" as a new sushi ingredient.

1. Check if it is a real food or drink item.
2. If valid, suggest a Web Audio synth profile and a fitting hex color.

Respond ONLY with valid JSON:
{"valid": true, "color": "#A0522D", "synth": {"freq": 220, "wave": "sine", "decay": 0.25, "gain": 0.5, "filter": {"type": "lowpass", "freq": 800}}}

If NOT food: {"valid": false}

Ingredient: ${description.trim()}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              response_mime_type: 'application/json'
            }
          })
        }
      );

      if (!res.ok) throw new Error(`API Error: ${res.status}`);

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      if (parsed.valid) {
        // 1. Register the new sound in the Audio engine
        const voiceIdx = Audio.addDynamicVoice(parsed.synth);

        // 2. Add to global definitions so it appears on the shelf
        INGREDIENT_DEFS.push({
          name: description.trim().toLowerCase(),
          color: parsed.color || '#AAAAAA',
          voiceIdx: voiceIdx
        });

        // 3. Refresh the UI components
        if (typeof renderShelf === 'function') renderShelf();
        if (inputField) inputField.value = '';

      } else {
        alert(`"${description}" doesn't seem like a sushi ingredient! 🍣`);
      }
    } catch (err) {
      console.error('Gemini Error:', err);
      alert('Failed to create ingredient. Check console.');
    } finally {
      if (btnEl) {
        btnEl.innerHTML = origHTML;
        btnEl.disabled = false;
      }
    }
  }

  // Maintaining empty functions for sequencer compatibility in app.js
  return {
    generateIngredient,
    notify: () => {},
    clearSuggestions: () => {},
    getSuggestions: () => [],
    acceptSuggestion: () => {}
  };
})();