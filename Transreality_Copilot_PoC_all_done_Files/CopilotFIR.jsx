
import React, { useEffect, useState } from "react";

/**
 * CopilotFIR.jsx
 * Functional React component that interacts with the Transreality PoC API.
 * Props:
 *  - baseUrl : base URL of the backend (e.g. http://localhost:3001)
 *  - sessionId : optional session id to load. If absent, offers to create a test event.
 */

export default function CopilotFIR({ baseUrl = "http://localhost:3001", sessionId: initialSessionId = null }) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);
  const [lastActionResult, setLastActionResult] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch(`${baseUrl}/api/v1/session/${sessionId}`)
      .then(r => r.json())
      .then(data => setSession(data))
      .catch(err => appendLog("error", "Failed to fetch session: " + err.message))
      .finally(() => setLoading(false));
  }, [sessionId, baseUrl]);

  function appendLog(from, text) {
    setLog(l => [{ from, text, ts: new Date().toISOString() }, ...l].slice(0, 200));
  }

  async function createTestEvent() {
    const payload = {
      event_id: "evt-" + Math.random().toString(36).slice(2,9),
      summary: "Demo event created from CopilotFIR UI",
      initial_confidence: 0.65,
      metadata: { sensitive: false }
    };
    appendLog("ui", "Posting test event: " + payload.event_id);
    try {
      const res = await fetch(`${baseUrl}/api/v1/events/artemis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.status === 201) {
        appendLog("server", "Created session " + data.session_id + " triage: " + data.triage_status);
        setSessionId(data.session_id);
      } else {
        appendLog("server", "Error creating event: " + JSON.stringify(data));
      }
    } catch (e) {
      appendLog("error", "Network error creating event: " + e.message);
    }
  }

  async function performAction(action, justification = "") {
    if (!sessionId) {
      appendLog("ui", "No session id");
      return;
    }
    appendLog("ui", `Requesting action ${action}`);
    try {
      const res = await fetch(`${baseUrl}/api/v1/session/${sessionId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, justification, actor: "ui.demo" })
      });
      const data = await res.json();
      setLastActionResult({ action, data });
      appendLog("server", `Action response: ${JSON.stringify(data)}`);
      // reload session
      const sres = await fetch(`${baseUrl}/api/v1/session/${sessionId}`);
      const sdata = await sres.json();
      setSession(sdata);
    } catch (e) {
      appendLog("error", "Action failed: " + e.message);
    }
  }

  return (
    <div className="p-4 border rounded bg-white shadow-sm">
      <h2 className="text-xl font-semibold">Transreality Copilot — FIR</h2>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-2">
            <label className="block text-sm font-medium">Session ID</label>
            <input className="mt-1 p-2 border rounded w-full" value={sessionId || ""} onChange={e => setSessionId(e.target.value)} placeholder="Paste or create a session id"/>
          </div>

          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded" onClick={() => createTestEvent()}>Create test event</button>
            <button className="px-3 py-1 border rounded" onClick={() => { if (sessionId) { setSessionId(sessionId); appendLog("ui","Reload session requested"); } }}>Reload</button>
            <button className="px-3 py-1 border rounded" onClick={() => { setSessionId(""); setSession(null); appendLog("ui","Cleared session"); }}>Clear</button>
          </div>

          <div className="mt-4 p-3 border rounded">
            <h3 className="font-semibold">Actions</h3>
            <div className="flex gap-2 mt-2">
              <button className="px-3 py-1 border rounded" onClick={() => performAction("investigate", "Initial analyst check")}>Investigate</button>
              <button className="px-3 py-1 border rounded" onClick={() => performAction("request_isr", "Request ISR for verification")}>Request ISR</button>
              <button className="px-3 py-1 border rounded" onClick={() => performAction("escalate", "Escalate to command")}>Escalate</button>
              <button className="px-3 py-1 border rounded" onClick={() => performAction("dismiss", "Dismiss as false positive")}>Dismiss</button>
            </div>
            {lastActionResult && (
              <div className="mt-3 text-sm">
                <div><strong>Last action:</strong> {lastActionResult.action}</div>
                <pre className="mt-2 p-2 bg-gray-50 border rounded text-xs">{JSON.stringify(lastActionResult.data, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="p-3 border rounded">
            <h3 className="font-semibold">Session</h3>
            {loading && <div>Loading...</div>}
            {!session && !loading && <div className="text-sm text-gray-500">No session loaded.</div>}
            {session && (
              <div className="text-sm">
                <div><strong>Session ID:</strong> {session.session_id}</div>
                <div><strong>Event ID:</strong> {session.event_id}</div>
                <div><strong>Summary:</strong> {session.summary}</div>
                <div><strong>Triage:</strong> {session.ternary_recommendation} (confidence {session.confidence})</div>
                <div><strong>Ethics score:</strong> {session.ethics_score}</div>
                <div className="mt-2">
                  <strong>Scenarios</strong>
                  <ul className="list-disc pl-5">
                    {session.scenarios && session.scenarios.map((s,i) => <li key={i}>{s.label} — {s.description} ({s.probability})</li>)}
                  </ul>
                </div>
                <div className="mt-2">
                  <strong>Audit log</strong>
                  <div className="mt-2 max-h-40 overflow-auto p-2 bg-gray-50 border rounded text-xs">
                    {session.audit_log && session.audit_log.map((a,i) => (
                      <div key={i} className="mb-2">
                        <div className="font-mono text-xs text-gray-500">{a.ts} — {a.action}</div>
                        <div>{a.justification || JSON.stringify(a.detail || {})}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 p-3 border rounded h-48 overflow-auto">
            <h3 className="font-semibold">Logs</h3>
            {log.map((m,i) => (
              <div key={i} className="mt-2 text-sm">
                <div className="font-mono text-xs text-gray-500">{m.from} · {new Date(m.ts).toLocaleString()}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
