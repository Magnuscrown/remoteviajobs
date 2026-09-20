export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobDescription, userCV } = req.body;

  if (!jobDescription || !userCV) {
    return res.status(400).json({ error: 'Missing job description or CV' });
  }

  const prompt = `You are an ATS (Applicant Tracking System) expert. Analyze the following job description and the user's CV.

JOB DESCRIPTION:
${jobDescription.substring(0, 3000)}

USER'S CV:
${userCV.substring(0, 3000)}

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "matchScore": <number between 0 and 100>,
  "topKeywords": [<array of 10-15 most important ATS keywords from the job description>],
  "matchedKeywords": [<array of keywords from the job that ARE in the user's CV>],
  "missingKeywords": [<array of important keywords from the job that are NOT in the user's CV>],
  "summary": "<one sentence summary of the match>"
}`;

  // Try Gemini first (primary)
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    const geminiData = await geminiResponse.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const clean = text.replace(/```json|```/g, '').trim();
      return res.status(200).json({ provider: 'gemini', ...JSON.parse(clean) });
    }
  } catch (err) {
    console.log('Gemini failed:', err.message);
  }

  // Fallback: Groq
  try {
    const groqKey = process.env.GROQ_API_KEY;
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });
    const groqData = await groqResponse.json();
    const text = groqData.choices?.[0]?.message?.content;
    if (text) {
      const clean = text.replace(/```json|```/g, '').trim();
      return res.status(200).json({ provider: 'groq', ...JSON.parse(clean) });
    }
  } catch (err) {
    console.log('Groq failed:', err.message);
  }

  // Final fallback: OpenRouter
  try {
    const orKey = process.env.OPENROUTER_API_KEY;
    const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${orKey}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const orData = await orResponse.json();
    const text = orData.choices?.[0]?.message?.content;
    if (text) {
      const clean = text.replace(/```json|```/g, '').trim();
      return res.status(200).json({ provider: 'openrouter', ...JSON.parse(clean) });
    }
  } catch (err) {
    console.log('OpenRouter failed:', err.message);
  }

  return res.status(500).json({ error: 'All AI providers failed. Please try again.' });
}
