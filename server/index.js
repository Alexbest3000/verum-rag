require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error('❌  GEMINI_API_KEY not found in .env');
  console.error('    Get free key at: aistudio.google.com');
  process.exit(1);
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── KNOWLEDGE BASE (VERUM C4) ─────────────────────────────────────────────
const KB = [
  { id: 'overview', title: 'VERUM Overview',
    content: `VERUM is a distributed forensic analysis platform to detect synthetic media (deepfakes, AI-generated content), analyze psychological manipulation, and provide multi-lens intelligence assessment. Combines image forensics, video analysis, psychological profiling, strategic intelligence.` },
  { id: 'containers', title: 'C2 Containers',
    content: `VERUM-APP: Node.js + Express.js port 5000 — image forensic analysis, EXIF metadata extraction, multi-lens prompt generation (CRITIC, PRIME, EMPIRE, ORACLE), Gemini AI integration.
VERUM-MUSCLE: Python + FastAPI port 8080 — video processing yt-dlp, B2B cognitive firewall, Gemini 2.5 Flash-Lite.
Client: React 18 + Vite + TailwindCSS + Lucide Icons.` },
  { id: 'endpoints-app', title: 'VERUM-APP Endpoints',
    content: `POST /api/analyze — main image analysis (ELA + EXIF + Gemini)
POST /api/waitlist — waitlist registration
GET /api/logs — historical analysis logs
GET /health — health check
POST /api/verify-code — authentication` },
  { id: 'endpoints-muscle', title: 'VERUM-MUSCLE Endpoints',
    content: `POST /process-video — YouTube link download and analysis
POST /api/analyze-video-file — direct video file upload analysis
POST /api/b2b/sanitize — enterprise prompt injection filtering
POST /api/b2b-proxy — B2B request proxy
GET / — health status` },
  { id: 'ela', title: 'ELA Pipeline & Image Flow',
    content: `POST /api/analyze flow:
1. Extract Base64 → Buffer.from(base64,'base64')
2. Read EXIF → ExifParser.create(buffer) → {status,report,size}
3. Generate ELA maps via sharp: compress/recompress JPEG 90%, difference blend, linear enhancement → Normal & Inverted maps
4. Build God Mode Prompt → lens: critic|prime|empire|oracle, mode: scan|read|face|oracle
5. Build Gemini request → parts: [Prompt, Original img, ELA Normal, ELA Inverted]
6. Call Gemini API (@google/generative-ai)
7. Parse JSON → {verdict,score,analysis,recommendation}
8. Save log → memoryHistory.unshift (max 50)` },
  { id: 'video', title: 'Video Analysis Pipeline',
    content: `POST /process-video flow:
1. Configure yt-dlp: format best[ext=mp4][filesize<50M], force IPv4, output /tmp/{id}.mp4
2. Download via ydl.extract_info
3. Upload to Google Files API
4. Wait for processing state == ACTIVE
5. Send to Gemini 2.5-flash-lite for keyframe + audio transcript
6. Parse JSON response
7. Cleanup temp files` },
  { id: 'b2b', title: 'B2B Cognitive Firewall',
    content: `POST /api/b2b/sanitize — prompt injection filter:
1. Validate input text
2. Build Enterprise Cognitive Firewall security prompt
3. Call Gemini 2.5-flash to detect manipulation attempts
4. Return {status:"safe"|"blocked", reason:"..."}
Sanitizes prompts before passing to enterprise AI systems.` },
  { id: 'stack', title: 'Technology Stack',
    content: `Frontend: React 18.2.0, Vite 5.0.0, TailwindCSS 3.4.0, Lucide React 0.294.0, exif-js 2.3.0
Backend Node (VERUM-APP): Express 4.18.2, Sharp 0.34.5, exif-parser 0.1.12, node-fetch 3.3.2, multer 1.4.5, @google/generative-ai 0.1.3
Backend Python (VERUM-MUSCLE): FastAPI, uvicorn, yt-dlp, google-genai, pydantic, python-multipart
External APIs: Google Gemini 2.5-flash, Gemini 2.5-flash-lite, Google Files API, Google Sheets v4` },
  { id: 'lenses', title: 'Multi-Lens Analysis (God Mode)',
    content: `Four analytical lenses in BRAIN module:
CRITIC — critical forensic analysis, detecting manipulation artifacts
PRIME — psychological profiling, behavioral analysis
EMPIRE — strategic intelligence, asset auditing
ORACLE — deep pattern recognition, predictive analysis
Modes: scan, read, face, oracle
Each lens+mode generates a specialized God Mode Prompt sent to Gemini.` },
  { id: 'deployment', title: 'Deployment Architecture',
    content: `Cloud: CDN/Load Balancer (Cloudflare/AWS) → 3 service groups:
- VERUM-APP Node.js: 3-5 instances
- VERUM-MUSCLE FastAPI: 2-3 instances
- Static files (React build)
Stateless → horizontal scaling. Round-robin LB. No session state.
Bottlenecks: Gemini rate limits → Redis/RabbitMQ; video → Celery async; files → S3/GCS; ELA ~500MB RAM/image.` },
  { id: 'security', title: 'Security & Logging',
    content: `Security: HTTPS/TLS everywhere, API keys in env vars, input validation all endpoints, B2B prompt injection detection, EXIF not stored long-term, 50MB file size limit.
Logging: in-memory buffer last 50 analyses, Google Sheets for persistent audit trail with timestamps.
Monitoring: Winston + Python logging, Prometheus + Grafana, Jaeger/AWS X-Ray tracing.` },
  { id: 'gemini', title: 'Google Gemini AI Integration',
    content: `Models: gemini-2.5-flash (image analysis, text, B2B firewall), gemini-2.5-flash-lite (video).
Request: multipart with 3 images (Original + ELA Normal + ELA Inverted) + God Mode Prompt.
Response: JSON {verdict, score, analysis, recommendation}.
SDK: @google/generative-ai (Node), google-genai (Python).` },
];

// ── RAG retrieval ─────────────────────────────────────────────────────────
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-zа-яё0-9]/gi, ' ').split(/\s+/).filter(w => w.length > 1);
}
function scoreChunk(query, chunk) {
  const qTokens = new Set(tokenize(query));
  const cTokens = tokenize(chunk.title + ' ' + chunk.content);
  const tf = {};
  cTokens.forEach(w => tf[w] = (tf[w] || 0) + 1);
  let score = 0;
  qTokens.forEach(q => {
    if (tf[q]) score += Math.log(1 + tf[q]);
    cTokens.forEach(c => { if (c !== q && (c.includes(q) || q.includes(c))) score += 0.35; });
  });
  return score;
}
function retrieve(query, topK = 3) {
  const scored = KB.map(c => ({ ...c, score: scoreChunk(query, c) })).sort((a, b) => b.score - a.score);
  const hits = scored.filter(c => c.score > 0);
  return (hits.length ? hits : scored).slice(0, topK);
}

// ── POST /api/chat ────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required' });
  }

  const chunks = retrieve(query);
  const context = chunks.map((c, i) => `[CHUNK ${i + 1}: ${c.title}]\n${c.content}`).join('\n\n---\n\n');

  const prompt = `You are a technical assistant for VERUM™ — a forensic deepfake detection platform.
Answer based ONLY on the documentation chunks below. Be precise and technical.
Answer in the same language as the question (Russian if asked in Russian).
Format endpoints and code in backticks. If info is not in chunks, say so honestly.

Documentation:
---
${context}
---

Question: ${query}`;

  try {
    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    res.json({
      answer,
      chunks: chunks.map(c => ({ id: c.id, title: c.title, score: c.score })),
    });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: 'gemini-2.0-flash', chunks: KB.length });
});

app.listen(PORT, () => {
  console.log(`✅  VERUM RAG running at http://localhost:${PORT}`);
  console.log(`    Model: gemini-2.0-flash (free tier)`);
  console.log(`    Knowledge base: ${KB.length} chunks`);
});
