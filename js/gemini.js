/**
 * gemini.js — SushiDAW Ingredient Creator (Vercel Proxy Version)
 * Uses a local Vercel serverless function to securely communicate with Gemini.
 */

const GeminiSuggest = (() => {
  async function generateIngredient(description) {
    if (!description || !description.trim()) return;

    const btnEl = document.querySelector('.ai-create-btn');
    const inputField = document.getElementById('ai-ing-input');
    const origHTML = btnEl ? btnEl.innerHTML : '';

    if (btnEl) {
      btnEl.innerHTML = '<span>⏳</span> rolling...';
      btnEl.disabled = true;
    }

    // This prompt instructs Gemini to return specific sound parameters for our Audio engine
    const prompt = `You are a sound designer for a sushi music app.
The user wants to add "${description.trim()}" as a new sushi ingredient.

1. Check if it is an actual food or drink item.
2. If valid, suggest a Web Audio synth profile and a fitting hex color based on flavor and texture.

Respond ONLY with valid JSON:
{"valid": true, "color": "#A0522D", "synth": {"freq": 220, "wave": "sine", "decay": 0.25, "gain": 0.5, "filter": {"type": "lowpass", "freq": 800}}}

If NOT food: {"valid": false}

Ingredient: ${description.trim()}`;

    try {
      // Call your Vercel serverless function proxy
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
      });

      if (!res.ok) throw new Error(`API Error: ${res.status}`);

      const data = await res.json();

      // Extract the JSON text from Gemini's response structure
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

      if (parsed.valid) {
        // 1. Register the new sound in the Audio engine
        const voiceIdx = Audio.addDynamicVoice(parsed.synth);

        // 2. Create the storable ingredient definition
        const newIng = {
          name: description.trim().toLowerCase(),
          color: parsed.color || '#AAAAAA',
          emoji: '✨',
          synth: parsed.synth
        };

        // 3. Add to global shelf definitions for the current session
        INGREDIENT_DEFS.push({
          name: newIng.name,
          color: newIng.color,
          emoji: newIng.emoji,
          voiceIdx: voiceIdx
        });

        // 4. Save to LocalStorage so it survives refreshes
        try {
          const saved = JSON.parse(localStorage.getItem('sushidaw_custom_ingredients') || '[]');
          if (!saved.some(i => i.name === newIng.name)) {
            saved.push(newIng);
            localStorage.setItem('sushidaw_custom_ingredients', JSON.stringify(saved));
          }
        } catch(e) {
          console.error("Could not save custom ingredient", e);
        }

        // 5. Refresh the UI components
        if (typeof renderShelf === 'function') renderShelf();
        if (inputField) inputField.value = '';

      } else {
        alert(`"${description}" doesn't seem like a sushi ingredient! 🍣`);
      }
    } catch (err) {
      console.error('Gemini Proxy Error:', err);
      alert('Failed to create ingredient. See console for details.');
    } finally {
      if (btnEl) {
        btnEl.innerHTML = origHTML;
        btnEl.disabled = false;
      }
    }
  }

  // Necessary for app.js integration
  return {
    generateIngredient,
    notify: () => {},
    clearSuggestions: () => {},
    getSuggestions: () => [],
    acceptSuggestion: () => {}
  };
})();