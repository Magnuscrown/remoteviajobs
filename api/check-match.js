export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobDescription, userCV } = req.body;

  if (!jobDescription || !userCV) {
    return res.status(400).json({ error: 'Missing job description or CV' });
  }

  const prompt = `You are an expert ATS (Applicant Tracking System) and career coach.

Analyze the JOB DESCRIPTION and the USER'S CV below, then return a detailed, personalized analysis.

JOB DESCRIPTION:
${jobDescription.substring(0, 3500)}

USER'S CV:
${userCV.substring(0, 3500)}

Return ONLY a valid JSON object with this EXACT structure (no markdown, no extra text):

{
  "matchScore": <number 0-100>,
  "summary": "<2-3 sentences addressed directly to the user. Use 'Your CV...' NOT 'The user's CV...'. Be encouraging but honest. Explain the match level and the biggest opportunity for improvement.>",
  "yearsExperience": {
    "detected": "<approximate years of experience detected in the CV>",
    "required": "<years of experience required by the job>",
    "verdict": "<one short sentence comparing them>"
  },
  "whyItFits": ["<3-5 bullet points of strengths from the CV that match the job>"],
  "whyItDoesntFit": ["<3-5 bullet points of gaps — skills, experience, or keywords the job wants but the CV lacks>"],
  "topSkills": ["<3-5 top skills from the CV that are most relevant to this job>"],
  "matchedKeywords": ["<10-15 ATS keywords that appear in BOTH the job and the CV>"],
  "missingKeywords": ["<10-15 important ATS keywords from the job that are NOT in the CV>"],
  "recommendation": "<one actionable sentence telling the user the next best step>"
}`;

  const errors = [];

  // 1. Try Gemini (Primary)
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error('GEMINI_API_KEY not set');
    
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );
    const geminiData = await geminiResponse.json();
    if (!geminiResponse.ok) {
      throw new Error(`Gemini ${geminiResponse.status}: ${JSON.stringify(geminiData).substring(0,200)}`);
    }
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
      return res.status(200).json({ provider: 'gemini', ...JSON.parse(clean) });
    }
    throw new Error('Gemini returned no text');
  } catch (err) {
    errors.push('Gemini: ' + err.message);
  }

  // 2. Try Groq
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('GROQ_API_KEY not set');
    
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
    if (!groqResponse.ok) {
      throw new Error(`Groq ${groqResponse.status}: ${JSON.stringify(groqData).substring(0,200)}`);
    }
    const text = groqData.choices?.[0]?.message?.content;
    if (text) {
      const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
      return res.status(200).json({ provider: 'groq', ...JSON.parse(clean) });
    }
    throw new Error('Groq returned no text');
  } catch (err) {
    errors.push('Groq: ' + err.message);
  }

  // 3. Try Cerebras
  try {
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    if (!cerebrasKey) throw new Error('CEREBRAS_API_KEY not set');
    
    const cerebrasResponse = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cerebrasKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });
    const cerebrasData = await cerebrasResponse.json();
    if (!cerebrasResponse.ok) {
      throw new Error(`Cerebras ${cerebrasResponse.status}: ${JSON.stringify(cerebrasData).substring(0,200)}`);
    }
    const text = cerebrasData.choices?.[0]?.message?.content;
    if (text) {
      const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
      return res.status(200).json({ provider: 'cerebras', ...JSON.parse(clean) });
    }
    throw new Error('Cerebras returned no text');
  } catch (err) {
    errors.push('Cerebras: ' + err.message);
  }

  // 4. Try Mistral
  try {
    const mistralKey = process.env.MISTRAL_API_KEY;
    if (!mistralKey) throw new Error('MISTRAL_API_KEY not set');
    
    const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });
    const mistralData = await mistralResponse.json();
    if (!mistralResponse.ok) {
      throw new Error(`Mistral ${mistralResponse.status}: ${JSON.stringify(mistralData).substring(0,200)}`);
    }
    const text = mistralData.choices?.[0]?.message?.content;
    if (text) {
      const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
      return res.status(200).json({ provider: 'mistral', ...JSON.parse(clean) });
    }
    throw new Error('Mistral returned no text');
  } catch (err) {
    errors.push('Mistral: ' + err.message);
  }

  // 5. Try OpenRouter (Final fallback)
  try {
    const orKey = process.env.OPENROUTER_API_KEY;
    if (!orKey) throw new Error('OPENROUTER_API_KEY not set');
    
    const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${orKey}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const orData = await orResponse.json();
    if (!orResponse.ok) {
      throw new Error(`OpenRouter ${orResponse.status}: ${JSON.stringify(orData).substring(0,200)}`);
    }
    const text = orData.choices?.[0]?.message?.content;
    if (text) {
      const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
      return res.status(200).json({ provider: 'openrouter', ...JSON.parse(clean) });
    }
    throw new Error('OpenRouter returned no text');
  } catch (err) {
    errors.push('OpenRouter: ' + err.message);
  }

  return res.status(500).json({ 
    error: 'All AI providers failed.', 
    details: errors 
  });
}
