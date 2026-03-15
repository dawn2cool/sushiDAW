export default async function handler(req, res) {
  const API_KEY = process.env.GROQ_KEY; // Pulled from Vercel Project Settings

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req.body;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 1.0,
        seed: Math.floor(Math.random() * 1000000),
        messages: [
          {
            role: "system",
            content: "You are a drum machine. Output ONLY a JSON object. No conversation. Format: {\"bpm\": 125, \"grid\": {\"0\": [indices], \"1\": [indices], \"2\": [indices], \"3\": [indices], \"4\": [indices], \"5\": [indices], \"6\": [indices], \"7\": [indices]}}. Use 16 steps (0-15). Ensure high note density."
          },
          { role: "user", content: `Create a unique 16-step beat for: ${query}` }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Groq Generation Failed' });
  }
}