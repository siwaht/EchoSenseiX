export {};

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

type WebhookCase = {
  name: string;
  path: string;
  payload: Record<string, unknown>;
  expected: number[];
};

const cases: WebhookCase[] = [
  {
    name: "post-call",
    path: "/api/webhooks/elevenlabs/post-call",
    payload: {
      conversation_id: `test-${Date.now()}`,
      agent_id: "test-agent-id",
      call_status: "completed",
      call_duration_seconds: 1,
      transcript: { text: "integration test" },
    },
    expected: [200, 400, 503],
  },
  {
    name: "conversation-init",
    path: "/api/webhooks/elevenlabs/conversation-init",
    payload: {
      conversation_id: `init-${Date.now()}`,
      agent_id: "test-agent-id",
      phone_number: "+10000000000",
    },
    expected: [200, 503],
  },
  {
    name: "events",
    path: "/api/webhooks/elevenlabs/events",
    payload: {
      event_type: "tool.called",
      conversation_id: `event-${Date.now()}`,
      agent_id: "test-agent-id",
      data: { tool_name: "integration-test" },
    },
    expected: [200, 400],
  },
];

let failed = 0;
for (const testCase of cases) {
  const response = await fetch(`${BASE_URL}${testCase.path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testCase.payload),
  });

  const body = await response.text();
  const passed = testCase.expected.includes(response.status);
  console.log(`${passed ? "PASS" : "FAIL"} ${testCase.name}: ${response.status} ${body}`);
  if (!passed) failed++;
}

if (failed > 0) {
  process.exitCode = 1;
}
