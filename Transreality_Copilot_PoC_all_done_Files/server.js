
/**
 * Transreality PoC server.js (reconstructed)
 * Implements endpoints described in openapi.yaml for PoC/demo purposes.
 * Note: sandbox implementation (in-memory stores). Add mTLS/JWT and persistent DB for production.
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// In-memory stores
const sessions = {}; // session_id -> session object
const audits = {};   // session_id -> audit array

// Utility: simple ternary recommender and ethics gate stub
function computeTernaryRecommendation(confidence) {
  if (confidence >= 0.75) return 'yes';
  if (confidence <= 0.4) return 'no';
  return 'undefined';
}

function computeEthicsScore(event) {
  const meta = event.metadata || {};
  let score = 0.9;
  if (meta.sensitive) score = 0.3;
  if (meta.pii) score = 0.2;
  return score; // 0..1
}

function generateScenarios(event) {
  return [
    { label: 'Monitor & log', description: 'Keep monitoring, request ISR if escalates', probability: 0.55 },
    { label: 'Request ISR', description: 'Task ISR assets for verification', probability: 0.3 },
    { label: 'Escalate to command', description: 'Escalate for immediate action', probability: 0.15 },
  ];
}

// POST /api/v1/events/artemis
app.post('/api/v1/events/artemis', (req, res) => {
  const event = req.body;
  if (!event || !event.event_id) {
    return res.status(400).json({ error: 'Missing event payload or event_id' });
  }

  const session_id = uuidv4();
  const now = new Date().toISOString();

  const initial_confidence = typeof event.initial_confidence === 'number' ? event.initial_confidence : 0.5;
  const ternary_recommendation = computeTernaryRecommendation(initial_confidence);
  const ethics_score = computeEthicsScore(event);
  const scenarios = generateScenarios(event);

  const session = {
    session_id,
    event_id: event.event_id,
    created_at: now,
    event,
    summary: event.summary || (event.description || '').slice(0, 200),
    ternary_recommendation,
    confidence: initial_confidence,
    scenarios,
    ethics_score,
    audit_log: [],
  };

  sessions[session_id] = session;
  audits[session_id] = [];

  audits[session_id].push({ ts: now, action: 'ingest_event', detail: { event_id: event.event_id } });
  session.audit_log = audits[session_id];

  return res.status(201).json({ session_id, triage_status: ternary_recommendation });
});

// GET /api/v1/session/:session_id
app.get('/api/v1/session/:session_id', (req, res) => {
  const id = req.params.session_id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ error: 'Session not found' });
  return res.json(JSON.parse(JSON.stringify(s)));
});

// POST /api/v1/session/:session_id/action
app.post('/api/v1/session/:session_id/action', (req, res) => {
  const id = req.params.session_id;
  const s = sessions[id];
  if (!s) return res.status(404).json({ error: 'Session not found' });

  const { action, justification, actor } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Missing action' });

  const allowed = ['investigate', 'request_isr', 'escalate', 'dismiss'];
  if (!allowed.includes(action)) return res.status(400).json({ error: 'Unsupported action' });

  const ethics_allowed = (s.ethics_score || 1) > 0.4 || action === 'investigate';
  const ethics_status = ethics_allowed ? 'approved' : 'blocked';

  const action_id = uuidv4();
  const ts = new Date().toISOString();
  const entry = { ts, action_id, action, justification: justification || '', actor: actor || 'operator', ethics_status };

  audits[id].push(entry);
  s.audit_log = audits[id];

  if (action === 'investigate') {
    s.confidence = Math.min(1, s.confidence + 0.05);
  } else if (action === 'request_isr') {
    s.scenarios.unshift({ label: 'ISR in progress', description: 'ISR tasked', probability: 0.6 });
  } else if (action === 'escalate') {
    s.ternary_recommendation = 'yes';
  } else if (action === 'dismiss') {
    s.ternary_recommendation = 'no';
  }

  return res.status(200).json({ action_id, ethics_status });
});

// Health check
app.get('/healthz', (req, res) => res.json({ status: 'ok', now: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Transreality PoC server listening on ${PORT}`);
});
