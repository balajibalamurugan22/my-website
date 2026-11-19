require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
let inMemoryApiKey = null;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get effective API key (header -> in-memory -> process.env)
function getApiKey(req) {
  const headerKey = req.headers['x-gemini-api-key'];
  if (headerKey && typeof headerKey === 'string' && headerKey.trim().length > 10) {
    return headerKey.trim();
  }
  if (inMemoryApiKey) {
    return inMemoryApiKey;
  }
  return process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
}

// Robust HTTPS POST using IPv4 with fast failover (fixes Windows IPv6 connect timeout)
function httpsPost(urlStr, bodyObj, retries = 0) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const dataStr = JSON.stringify(bodyObj);
      const parsed = new URL(urlStr);

      const req = https.request({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        family: 4, // Force IPv4 to prevent Windows IPv6 connect timeouts
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataStr),
          'Connection': 'close'
        },
        timeout: 9000 // Fast 9-second model timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsedData });
          } catch (e) {
            reject(new Error(`Failed to parse Gemini response: ${e.message}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 300);
        } else {
          reject(new Error('Model request timed out after 9 seconds'));
        }
      });

      req.on('error', (err) => {
        if (remaining > 0 && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'EPIPE')) {
          setTimeout(() => attempt(remaining - 1), 300);
        } else {
          reject(err);
        }
      });

      req.write(dataStr);
      req.end();
    };

    attempt(retries);
  });
}

// Direct Gemini API call with smart model fallback & IPv4 priority
async function callGeminiApi({ apiKey, model, contents, systemInstruction, generationConfig }) {
  let requestedModel = model || process.env.DEFAULT_MODEL || 'gemini-3.1-flash-lite';
  // Map rate-limited, deprecated, or unavailable models to verified active models
  if (!requestedModel || requestedModel.includes('2.5') || requestedModel.includes('1.5') || requestedModel.includes('3.5') || requestedModel.includes('3.8') || requestedModel.includes('pro')) {
    requestedModel = 'gemini-3.1-flash-lite';
  }

  const fallbackModels = [
    requestedModel,
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview'
  ].filter((m, i, arr) => arr.indexOf(m) === i); // deduplicate

  let lastError = null;

  for (const currentModel of fallbackModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

      const requestBody = {
        contents,
        generationConfig: {
          temperature: generationConfig?.temperature ?? 0.7,
          maxOutputTokens: generationConfig?.maxOutputTokens ?? 4096,
          topP: generationConfig?.topP ?? 0.95,
          responseMimeType: generationConfig?.responseMimeType || 'text/plain'
        }
      };

      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const response = await httpsPost(url, requestBody);
      const data = response.data;

      if (!response.ok) {
        const errorMsg = data?.error?.message || `Gemini API returned status ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.details = data;

        // Fallback for 404 (deprecated), 429 (rate-limited/no quota), or 503 (busy)
        if (response.status === 404 || response.status === 429 || response.status === 503) {
          console.warn(`Model ${currentModel} returned ${response.status}. Attempting fallback model...`);
          lastError = err;
          continue;
        }

        throw err;
      }

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map(p => p.text).join('') || '';
      return {
        text,
        finishReason: candidate?.finishReason,
        usageMetadata: data.usageMetadata,
        model: currentModel
      };
    } catch (err) {
      lastError = err;
      console.warn(`Model ${currentModel} failed: ${err.message}. Trying next fallback...`);
    }
  }

  // Rapid recovery retry on gemini-3.1-flash-lite
  try {
    await new Promise(r => setTimeout(r, 600));
    const recUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
    const recBody = {
      contents,
      generationConfig: {
        temperature: generationConfig?.temperature ?? 0.7,
        maxOutputTokens: 2048
      }
    };
    if (systemInstruction) {
      recBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const recRes = await httpsPost(recUrl, recBody);
    if (recRes.ok && recRes.data.candidates?.[0]) {
      return {
        text: recRes.data.candidates[0].content.parts.map(p => p.text).join(''),
        model: 'gemini-3.1-flash-lite'
      };
    }
  } catch (e) {}

  throw lastError || new Error('All model requests failed. Please try again.');
}

// ============================================================================
// AUTHENTICATION & USER STORE (Persistent JSON + Scrypt Password Hashing)
// ============================================================================
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const activeSessions = new Map(); // token -> { userId, email, name, isGuest, expiresAt }

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, hash, salt) {
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch (e) {
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function loadUsers() {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
      // Seed default demo user: explorer@lifegenie.ai / genie123
      const demoSalt = crypto.randomBytes(16).toString('hex');
      const defaultUsers = [
        {
          id: 'usr_demo_explorer',
          name: 'Alex Explorer',
          email: 'explorer@lifegenie.ai',
          passwordHash: hashPassword('genie123', demoSalt),
          salt: demoSalt,
          createdAt: new Date().toISOString()
        }
      ];
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf8');
      return defaultUsers;
    }
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load users DB:', err.message);
    return [];
  }
}

function saveUsers(users) {
  try {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save users DB:', err.message);
    return false;
  }
}

// Pre-initialize users on startup
loadUsers();

// Auth token extractor helper
function authenticateToken(req) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer ')) 
    ? authHeader.split(' ')[1] 
    : req.headers['x-auth-token'];

  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (session.expiresAt && Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

// ----------------------------------------------------------------------------
// AUTH ROUTES
// ----------------------------------------------------------------------------

// Register new user
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Please provide a valid name (at least 2 characters).' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const users = loadUsers();

  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists. Please sign in.' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const newUser = {
    id: 'usr_' + Date.now(),
    name: cleanName,
    email: cleanEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  const token = generateToken();
  const sessionData = {
    userId: newUser.id,
    name: newUser.name,
    email: newUser.email,
    isGuest: false,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  };
  activeSessions.set(token, sessionData);

  res.status(201).json({
    success: true,
    message: 'Account created successfully! Welcome to LIFEGENIE.',
    token,
    user: { id: newUser.id, name: newUser.name, email: newUser.email, isGuest: false }
  });
});

// Login existing user
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = loadUsers();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ success: false, message: 'Invalid email or password. Please try again.' });
  }

  const token = generateToken();
  const sessionData = {
    userId: user.id,
    name: user.name,
    email: user.email,
    isGuest: false,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  };
  activeSessions.set(token, sessionData);

  res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    token,
    user: { id: user.id, name: user.name, email: user.email, isGuest: false }
  });
});

// Guest 1-Click Access
app.post('/api/auth/guest', (req, res) => {
  const token = generateToken();
  const guestId = 'guest_' + Date.now();
  const sessionData = {
    userId: guestId,
    name: 'Explorer Guest',
    email: 'guest@lifegenie.ai',
    isGuest: true,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  activeSessions.set(token, sessionData);

  res.json({
    success: true,
    message: 'Signed in as Explorer Guest!',
    token,
    user: { id: guestId, name: 'Explorer Guest', email: 'guest@lifegenie.ai', isGuest: true }
  });
});

// Check current session
app.get('/api/auth/me', (req, res) => {
  const session = authenticateToken(req);
  if (!session) {
    return res.status(401).json({ authenticated: false, message: 'Not authenticated' });
  }
  res.json({
    authenticated: true,
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      isGuest: Boolean(session.isGuest)
    }
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer ')) 
    ? authHeader.split(' ')[1] 
    : req.headers['x-auth-token'];

  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});

// 1. Status & Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/status', (req) => {
  const apiKey = getApiKey(req);
  req.res.json({
    configured: Boolean(apiKey && apiKey !== 'your_gemini_api_key_here'),
    model: process.env.DEFAULT_MODEL || 'gemini-3-flash-preview',
    supportedModels: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast & Active)' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (High Reliability)' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Latest)' }
    ],
    timestamp: new Date().toISOString()
  });
});

// 2. Validate/Save API key endpoint
app.post('/api/validate-key', async (req, res) => {
  const testKey = req.body.apiKey ? req.body.apiKey.trim() : null;
  if (!testKey) {
    return res.status(400).json({ success: false, message: 'API key is required.' });
  }

  try {
    const result = await callGeminiApi({
      apiKey: testKey,
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: 'Hello, respond with: OK' }] }]
    });

    if (req.body.saveToEnv) {
      inMemoryApiKey = testKey;
      try {
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf8');
        }
        if (envContent.includes('GEMINI_API_KEY=')) {
          envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${testKey}`);
        } else {
          envContent += `\nGEMINI_API_KEY=${testKey}\nDEFAULT_MODEL=gemini-3.8-flash\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
        process.env.GEMINI_API_KEY = testKey;
      } catch (e) {
        console.warn('Could not write to .env file, key held in memory:', e.message);
      }
    }

    return res.json({ success: true, message: `Gemini API key is valid and connected! (Using ${result.model})` });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to authenticate with Gemini API. Please check your key.'
    });
  }
});

// 3. AI Assistant (Chat) endpoint
app.post('/api/chat', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(401).json({
      error: 'API_KEY_MISSING',
      message: 'Gemini API Key is not configured. Please open Settings in the top bar to enter your API key or configure GEMINI_API_KEY in .env.'
    });
  }

  const { messages, systemInstruction, model, temperature } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'INVALID_REQUEST', message: 'Messages array is required.' });
  }

  try {
    // Map messages into Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content || msg.text || '' }]
    }));

    const defaultSystem = `You are LIFEGENIE, an ultra-smart, direct, accurate, and concise personal AI assistant.
Core Directives:
- Give SHORT, CLEAR, and FACTUALLY ACCURATE answers. Get straight to the point.
- NEVER start with pleasantries, generic greetings, or repetitive intros (e.g. "Greetings! I am LIFEGENIE...", "I would be delighted to..."). Begin immediately with the answer.
- For factual, conceptual, or simple questions, give a direct, accurate answer in 1-3 sentences.
- For technical, coding, or multi-step queries, provide the exact correct solution with clean, concise formatting (bullet points, concise code blocks).
- Avoid fluff, unnecessary padding, or repetitive wrap-up sentences. Prioritize precision and brevity.`;

    const result = await callGeminiApi({
      apiKey,
      model: model || process.env.DEFAULT_MODEL || 'gemini-3.1-flash-lite',
      contents,
      systemInstruction: systemInstruction || defaultSystem,
      generationConfig: {
        temperature: typeof temperature === 'number' ? temperature : 0.4
      }
    });

    res.json({
      content: result.text,
      model: result.model,
      usage: result.usageMetadata
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(error.status || 500).json({
      error: 'GEMINI_ERROR',
      message: error.message || 'An error occurred while generating a response from Gemini.'
    });
  }
});

// 4. Study Genie endpoint
app.post('/api/study', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(401).json({
      error: 'API_KEY_MISSING',
      message: 'Gemini API Key is required. Please set it in Settings.'
    });
  }

  const { action, topic, level, subject, grade, examDate, notes, numQuestions } = req.body;

  let prompt = '';
  let responseMimeType = 'text/plain';

  switch (action) {
    case 'concept':
      prompt = `Explain the following academic concept in depth:
Topic: "${topic}"
Subject/Field: ${subject || 'General'}
Target Audience/School Stage: ${grade || level || 'High School'}

Structure your response with:
1. 💡 Core Concept (clear 2-3 sentence definition)
2. 🍎 Intuitive Real-World Analogy (something memorable)
3. 🔬 Key Mechanics / How It Works (step-by-step breakdown tailored to ${grade || level || 'High School'} syllabus)
4. 🌟 Why It Matters & Real-World Applications
5. 📝 Quick Self-Check Question & Answer`;
      break;

    case 'simple':
      prompt = `Explain the difficult topic "${topic}" in extremely simple, intuitive language (ELI5 / Explain Like I'm 5 style).
Use simple analogies, zero confusing jargon without explaining it immediately, vivid examples, and fun metaphors.`;
      break;

    case 'quiz':
      responseMimeType = 'application/json';
      const studentStage = grade || 'Class 9 (High School)';
      prompt = `Create an interactive multiple-choice quiz about "${topic}" (${subject || 'General'}).
Target Education Level / School Stage: ${studentStage}
Difficulty: ${level || 'Intermediate'}.
Number of questions: ${numQuestions || 5}.

CRITICAL GRADE & SYLLABUS ALIGNMENT RULES:
1. Every question MUST be strictly tailored to the curriculum, syllabus, and cognitive level of a student in ${studentStage}.
2. For subjects like Science, Biology, Chemistry, Physics, Mathematics, and Social Studies, match standard textbook coverage (e.g. NCERT, CBSE, ICSE, or standard Grade 9/secondary curriculum).
3. Formulate the questions, options, and vocabulary at the appropriate depth for ${studentStage} (neither overly basic nor beyond the syllabus).
4. Each question must have exactly 4 choices with one unambiguously correct answer.
5. Provide a clear, educational explanation for the correct choice that helps a ${studentStage} student understand the concept deeply.

Return ONLY valid JSON matching this exact schema:
{
  "topic": "${topic}",
  "grade": "${studentStage}",
  "questions": [
    {
      "id": 1,
      "question": "Clear question text formulated for ${studentStage}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Clear explanation suitable for ${studentStage}."
    }
  ]
}`;
      break;

    case 'timetable':
      prompt = `Create an optimal, balanced study timetable for a student studying:
Topics/Subjects: "${topic}"
Target Goal/Exam Date: ${examDate || 'Upcoming Exam'}
Additional Notes: ${notes || 'Include healthy breaks, revision sessions, and practice problems.'}

Output a beautifully structured weekly schedule with time blocks, active recall sessions, Pomodoro break intervals, and daily milestones.`;
      break;

    case 'qa':
      prompt = `Provide a comprehensive educational answer and step-by-step solution for this student question:
Question: "${topic}"
Subject: ${subject || 'General'}
Show the step-by-step reasoning, formulas (if applicable), and final takeaway.`;
      break;

    default:
      prompt = `Explain and provide educational guidance on: ${topic}`;
  }

  try {
    const result = await callGeminiApi({
      apiKey,
      model: req.body.model || 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are the Study Genie, an elite academic tutor powered by Gemini AI. You inspire curiosity and make learning fast, intuitive, and fun.',
      generationConfig: {
        temperature: 0.6,
        responseMimeType
      }
    });

    if (action === 'quiz') {
      try {
        const parsed = JSON.parse(result.text);
        return res.json({ success: true, quiz: parsed });
      } catch (err) {
        // Fallback if model wrapped in markdown fences
        const cleaned = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return res.json({ success: true, quiz: parsed });
      }
    }

    res.json({ success: true, content: result.text });
  } catch (error) {
    console.error('Study Genie error:', error);
    res.status(error.status || 500).json({ error: 'GEMINI_ERROR', message: error.message });
  }
});

// 5. Idea Generator endpoint
app.post('/api/ideas', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(401).json({ error: 'API_KEY_MISSING', message: 'Gemini API Key is required.' });
  }

  const { category, topic, audience, vibe, count } = req.body;

  const prompt = `Generate ${count || 3} visionary, high-impact ideas for:
Category: "${category || 'Startup & Inventions'}"
Focus/Theme: "${topic || 'AI & Future Technology'}"
Target Audience: "${audience || 'Global Creators & Professionals'}"
Vibe/Style: "${vibe || 'Futuristic, High-Potential, Innovative'}"

For each idea, format clearly as:
### 💡 [Catchy Project Name & Tagline]
- **The Problem It Solves**: Clear pain point.
- **The Innovation / Solution**: What makes this unique and extraordinary.
- **Core Features**: 3-4 bullet points.
- **Monetization & Impact**: How it scales or benefits the world.
- **First Action Step**: What to build or validate on Day 1.

Make the ideas genuinely original, creative, and inspiring!`;

  try {
    const result = await callGeminiApi({
      apiKey,
      model: req.body.model || 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are the Idea Generator module of LIFEGENIE. You generate inventive, viral, cutting-edge concepts.',
      generationConfig: { temperature: 0.85 }
    });

    res.json({ success: true, content: result.text });
  } catch (error) {
    console.error('Idea Generator error:', error);
    res.status(error.status || 500).json({ error: 'GEMINI_ERROR', message: error.message });
  }
});

// 6. Writing Assistant endpoint
app.post('/api/write', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(401).json({ error: 'API_KEY_MISSING', message: 'Gemini API Key is required.' });
  }

  const { mode, prompt: userPrompt, text, tone, length } = req.body;

  let prompt = '';
  switch (mode) {
    case 'essay':
      prompt = `Write an exceptional essay on:
Topic: "${userPrompt}"
Tone: ${tone || 'Academic & Persuasive'}
Length: ${length || 'Comprehensive'}

Include:
- Compelling Title
- Strong Introduction with clear Thesis Statement
- Well-structured Body Paragraphs with evidence, arguments, and counterpoints
- Thoughtful Conclusion`;
      break;

    case 'story':
      prompt = `Write an engaging, atmospheric creative story:
Premise/Prompt: "${userPrompt}"
Tone/Genre: ${tone || 'Sci-Fi / Futuristic'}
Length: ${length || 'Medium'}

Focus on rich sensory imagery, authentic character emotions, suspense, and a satisfying arc.`;
      break;

    case 'letter':
      prompt = `Draft a high-impact, professional letter or email:
Purpose/Recipient: "${userPrompt}"
Tone: ${tone || 'Polished, Confident, & Professional'}
Key Points to Include: "${text || ''}"

Include Subject line, greeting, clear value proposition, call to action, and professional sign-off.`;
      break;

    case 'grammar':
      prompt = `Carefully proofread and polish the following text:
Original Text:
"""
${text}
"""

Please provide:
1. ✨ Polished & Corrected Version
2. 🔍 Breakdown of Changes (Grammar, Spelling, Punctuation, Sentence Flow)
3. 💡 Suggestions for further impact`;
      break;

    case 'rewrite':
      prompt = `Rewrite the following text with the specified tone:
Target Tone: ${tone || 'Executive & Compelling'}
Original Text:
"""
${text}
"""

Provide two versions:
1. Version A: Refined & Direct
2. Version B: Creative & Dynamic`;
      break;

    default:
      prompt = `Improve, draft, and polish this content: ${userPrompt || text}`;
  }

  try {
    const result = await callGeminiApi({
      apiKey,
      model: req.body.model || 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are an award-winning author, master editor, and communications strategist. You write with eloquence, precision, and flair.',
      generationConfig: { temperature: 0.7 }
    });

    res.json({ success: true, content: result.text });
  } catch (error) {
    console.error('Writing Assistant error:', error);
    res.status(error.status || 500).json({ error: 'GEMINI_ERROR', message: error.message });
  }
});

// 7. Goal Planner AI Breakdown endpoint
app.post('/api/goals/breakdown', async (req, res) => {
  const apiKey = getApiKey(req);
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(401).json({ error: 'API_KEY_MISSING', message: 'Gemini API Key is required.' });
  }

  const { title, category, targetDate, description } = req.body;

  const prompt = `Break down the following personal or professional goal into a realistic, step-by-step milestone action plan:
Goal Title: "${title}"
Category: "${category || 'Personal Growth'}"
Target Date: "${targetDate || 'In 3 months'}"
Additional Context: "${description || ''}"

Return ONLY a valid JSON object in this format:
{
  "summary": "Inspiring 1-sentence roadmap strategy",
  "estimatedDuration": "e.g. 8 weeks",
  "milestones": [
    {
      "step": 1,
      "title": "Clear milestone action title",
      "description": "Specific tactical action to take",
      "estimatedDays": 7,
      "priority": "High"
    }
  ],
  "protips": [
    "Tip 1 for staying accountable",
    "Tip 2 for overcoming obstacles"
  ]
}`;

  try {
    const result = await callGeminiApi({
      apiKey,
      model: req.body.model || 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are the Master Goal Strategist inside LIFEGENIE. You turn ambitious dreams into structured, high-probability execution plans.',
      generationConfig: {
        temperature: 0.5,
        responseMimeType: 'application/json'
      }
    });

    try {
      const parsed = JSON.parse(result.text);
      res.json({ success: true, plan: parsed });
    } catch (e) {
      const cleaned = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      res.json({ success: true, plan: parsed });
    }
  } catch (error) {
    console.error('Goal breakdown error:', error);
    res.status(error.status || 500).json({ error: 'GEMINI_ERROR', message: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 LIFEGENIE AI Assistant Server is running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`⚡ Powered by Google Gemini API`);
  console.log(`🔑 API Key Status: ${process.env.GEMINI_API_KEY ? 'Configured in .env' : 'Not configured yet (add via Settings or .env)'}`);
  console.log(`=================================================\n`);
});

