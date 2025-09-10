
#!/usr/bin/env bash
BASE=${1:-http://localhost:3001}
echo "Using base URL: $BASE"

echo "Creating test event..."
RESP=$(curl -s -X POST "$BASE/api/v1/events/artemis" -H "Content-Type: application/json" -d '{"event_id":"evt-test-1","summary":"Automated test event","initial_confidence":0.7,"metadata":{"sensitive":false}}')
echo "Response: $RESP"
SESSION_ID=$(echo "$RESP" | sed -n 's/.*"session_id":"\([^"]*\)".*/\1/p')
echo "Session ID: $SESSION_ID"

if [ -z "$SESSION_ID" ]; then
  echo "No session ID returned. Exiting."
  exit 1
fi

echo "Fetching session..."
curl -s "$BASE/api/v1/session/$SESSION_ID" | jq || true
echo

echo "Requesting ISR..."
curl -s -X POST "$BASE/api/v1/session/$SESSION_ID/action" -H "Content-Type: application/json" -d '{"action":"request_isr","justification":"Automated test","actor":"test.runner"}' | jq || true
echo

echo "Escalating..."
curl -s -X POST "$BASE/api/v1/session/$SESSION_ID/action" -H "Content-Type: application/json" -d '{"action":"escalate","justification":"Automated escalation","actor":"test.runner"}' | jq || true
echo

echo "Final session..."
curl -s "$BASE/api/v1/session/$SESSION_ID" | jq || true
