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
    "detected": "<approximate years of experience detected in the CV, e.g. '3 years' or 'Not clearly stated'>",
    "required": "<years of experience required by the job, e.g. '5+ years' or 'Not specified'>",
    "verdict": "<one short sentence comparing them, e.g. 'Your experience is close to what they want.' or 'This role wants 2 more years than you have.'>"
  },
  "whyItFits": ["<3-5 bullet points of strengths from the CV that match the job>"],
  "whyItDoesntFit": ["<3-5 bullet points of gaps — skills, experience, or keywords the job wants but the CV lacks>"],
  "topSkills": ["<3-5 top skills from the CV that are most relevant to this job>"],
  "matchedKeywords": ["<10-15 ATS keywords that appear in BOTH the job and the CV>"],
  "missingKeywords": ["<10-15 important ATS keywords from the job that are NOT in the CV>"],
  "recommendation": "<one actionable sentence telling the user the next best step, e.g. 'Add Financial Technology and Product Strategy to your CV and highlight your 3 years of customer support experience.'>"
}`;

  const errors = [];

  // 1. Try Gemini
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

  // 3. Try OpenRouter
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
