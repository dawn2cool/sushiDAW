/* groq.js — Ultra-fast AI Beat Engine */
const GroqEngine = {
    async fetchBeat() {
        const query = document.getElementById('groq-query').value.trim();
        const btn = document.getElementById('groq-btn');
        
        if (!query || btn.classList.contains('cooking')) return;

        btn.classList.add('cooking');
        btn.textContent = "ZAPPING";

        const apiKey = window.ENV?.GROQ_KEY; 

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    temperature: 1.0, 
                    // This seed ensures a unique pattern every single time
                    seed: Math.floor(Math.random() * 1000000), 
                    messages: [
                        { 
                          role: "system", 
                          content: "You are a drum machine. Output ONLY a JSON object. No conversation. Format: {\"bpm\": 125, \"grid\": {\"0\": [indices], \"1\": [indices], \"2\": [indices], \"3\": [indices], \"4\": [indices], \"5\": [indices], \"6\": [indices], \"7\": [indices]}}. Use 16 steps (0-15). Ensure high note density." 
                        },
                        { role: "user", content: `Create a unique 16-step beat for: ${query}` }
                    ],
                    // This forces the AI to ONLY return a valid JSON object
                    response_format: { type: "json_object" }
                })
            });

            const result = await response.json();
            const data = JSON.parse(result.choices[0].message.content);

            // 1. Safety Check: If the AI sent an empty grid, throw error to trigger retry
            if (!data.grid || Object.keys(data.grid).length === 0) {
                throw new Error("Empty Grid");
            }

            // 2. Update BPM
            window.bpm = data.bpm || 128;
            const bpmDisp = document.getElementById('bpm-display'); 
            if (bpmDisp) bpmDisp.textContent = window.bpm;
            
            // 3. Update Grid
            const activeGrid = window.patterns[window.activePat];
            activeGrid.forEach(ch => ch.forEach(s => s.active = false));

            // 4. Map the AI indices to the DAW
            Object.entries(data.grid).forEach(([chIdx, steps]) => {
                const channel = activeGrid[parseInt(chIdx)];
                if (channel && Array.isArray(steps)) {
                    steps.forEach(s => {
                        if (s >= 0 && s < 16) channel[s].active = true;
                    });
                }
            });

            if (typeof renderRack === 'function') renderRack();
            btn.textContent = "READY";

        } catch (e) {
            console.error("Groq Error:", e);
            btn.textContent = "RETRY";
        } finally {
            setTimeout(() => {
                btn.classList.remove('cooking');
                if (btn.textContent !== "READY") btn.textContent = "ZAP";
            }, 1000);
        }
    }
};