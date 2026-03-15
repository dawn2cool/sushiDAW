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

Rules:
1. "valid" must be TRUE if the item is ANY edible food, fruit, vegetable, or drink. Be creative.
2. Only return "valid": false if the item is clearly not edible (e.g., "rock", "car", "keyboard").
3. Suggest a hex "color" that matches the food.
4. "synth" must include: "freq" (number 100-1000), "wave" ("sine","square","sawtooth","triangle"), "decay" (0.1-2.0), and "filter" (type: "lowpass", freq: 200-2000).

Return ONLY raw JSON:
{"valid": true, "color": "#HEX", "synth": {"freq": 440, "wave": "sine", "decay": 0.5, "gain": 0.5, "filter": {"type": "lowpass", "freq": 1000}}}`;

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