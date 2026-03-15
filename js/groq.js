/* groq.js — Ultra-fast AI Beat Engine */
/* groq.js — Updated for Secure Vercel Hosting */
const GroqEngine = {
    async fetchBeat() {
        const query = document.getElementById('groq-query').value.trim();
        const btn = document.getElementById('groq-btn');

        if (!query || btn.classList.contains('cooking')) return;

        btn.classList.add('cooking');
        btn.textContent = "ZAPPING";

        try {
            // Call your internal Vercel API endpoint
            const response = await fetch("/api/groq", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: query })
            });

            const result = await response.json();
            // Parse the content string returned by the LLM into a JSON object
            const data = JSON.parse(result.choices[0].message.content);

            if (!data.grid || Object.keys(data.grid).length === 0) {
                throw new Error("Empty Grid");
            }

            // Update DAW State
            window.bpm = data.bpm || 128;
            const bpmDisp = document.getElementById('bpm-display');
            if (bpmDisp) bpmDisp.textContent = window.bpm;

            const activeGrid = window.patterns[window.activePat];
            activeGrid.forEach(ch => ch.forEach(s => s.active = false));

            Object.entries(data.grid).forEach(([chIdx, steps]) => {
                const channel = activeGrid[parseInt(chIdx)];
                if (channel && Array.isArray(steps)) {
                    steps.forEach(s => {
                        if (s >= 0 && s < 16) channel[s].active = true;
                    });
                }
            });

            if (typeof renderRack === 'function') renderRack();
            if (typeof Mascot !== 'undefined') {
                Mascot.say('⚡ beat zapped!', 2800);
                Mascot.bounce();
            }
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