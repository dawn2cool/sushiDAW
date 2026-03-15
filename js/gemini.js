/**
 * gemini.js — SushiDAW Ingredient Creator
 * Uses Gemini API to validate food and generate synth parameters.
 */

const GeminiSuggest = (() => {
  const getKey = () => (typeof ENV !== 'undefined' ? GEMINI_KEY : '');

  async function generateIngredient(description) {
    if (!description || !description.trim()) return;

    const key = getKey();
    if (!key) {
      alert('Gemini API Key not found. Please check env.js');
      return;
    }

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

        // 2. Create the storable ingredient definition
        const newIng = {
          name: description.trim().toLowerCase(),
          color: parsed.color || '#AAAAAA',
          emoji: '✨', // Add a sparkle so you know it's custom AI!
          synth: parsed.synth
        };

        // 3. Add to global definitions for the current session
        INGREDIENT_DEFS.push({
          name: newIng.name,
          color: newIng.color,
          emoji: newIng.emoji,
          voiceIdx: voiceIdx
        });

        // 4. Save to LocalStorage so it survives refreshes
        try {
          const saved = JSON.parse(localStorage.getItem('sushidaw_custom_ingredients') || '[]');
          // Prevent exact duplicates
          if (!saved.some(i => i.name === newIng.name)) {
            saved.push(newIng);
            localStorage.setItem('sushidaw_custom_ingredients', JSON.stringify(saved));
          }
        } catch(e) { console.error("Could not save custom ingredient", e); }

        // 5. Refresh the UI
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

  return {
    generateIngredient,
    notify: () => {},
    clearSuggestions: () => {},
    getSuggestions: () => [],
    acceptSuggestion: () => {}
  };
})();