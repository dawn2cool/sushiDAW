export default async function handler(req, res) {
  const API_KEY = process.env.GEMINI_KEY; // Pulled from Vercel Project Settings

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: req.body.prompt }] }],
          generationConfig: {
            temperature: 0.7,
            response_mime_type: 'application/json'
          }
        })
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server Error' });
  }
}