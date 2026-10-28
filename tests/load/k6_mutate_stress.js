// k6 stress test: concurrent mutations against /api/mutate.
// Run: k6 run -e SITE_GATE_PASSWORD=... tests/load/k6_mutate_stress.js
// Expected statuses: 200 (applied) or 409 (optimistic-lock conflict). Anything else = failure.
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3050';
const GATE_PASSWORD = __ENV.SITE_GATE_PASSWORD || __ENV.TEST_GATE_PASSWORD || '';
const USERNAME = __ENV.K6_USER || 'superadmin';
const PASSWORD = __ENV.K6_PASSWORD || 'admin8391';
const ORG_ID = __ENV.K6_ORG_ID || 'ap';

const applied = new Counter('mutate_applied');
const conflicts = new Counter('mutate_conflicts_409');
const unexpected = new Counter('mutate_unexpected');

export const options = {
  scenarios: {
    concurrent_mutations: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '30s', target: 50 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.5'], // 409 counts as failed in k6; conflicts expected under contention
    http_req_duration: ['p(95)<1500'],
    mutate_unexpected: ['count==0'],
  },
};

export function setup() {
  const json = { headers: { 'Content-Type': 'application/json' } };
  const gateRes = http.post(`${BASE_URL}/api/gate`, JSON.stringify({ password: GATE_PASSWORD }), json);
  const gate = (gateRes.headers['Set-Cookie'] || '').match(/site_gate_pass=([^;]+)/);
  if (gateRes.status !== 200 || !gate) throw new Error(`gate unlock failed: ${gateRes.status}`);

  const gateCookie = `site_gate_pass=${gate[1]}`;
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json', Cookie: gateCookie } },
  );
  const sess = (loginRes.headers['Set-Cookie'] || '').match(/ebz_session=([^;]+)/);
  if (loginRes.status !== 200 || !sess) throw new Error(`login failed: ${loginRes.status}`);

  return { cookie: `${gateCookie}; ebz_session=${sess[1]}` };
}

export default function (data) {
  // Version is read from a stale-prone source on purpose: parallel VUs race on the same org.
  const orgRes = http.get(`${BASE_URL}/api/orgs?id=${ORG_ID}`, { headers: { Cookie: data.cookie } });
  let version = 1;
  try {
    const body = orgRes.json();
    const org = Array.isArray(body.data) ? body.data[0] : body.data;
    version = (org && org.version) || 1;
  } catch (_) {}

  const res = http.post(
    `${BASE_URL}/api/mutate`,
    JSON.stringify({
      action: 'update_content',
      orgId: ORG_ID,
      payload: { theme: `k6 stress vu=${__VU} iter=${__ITER}` },
      version,
    }),
    { headers: { 'Content-Type': 'application/json', Cookie: data.cookie } },
  );

  if (res.status === 200) applied.add(1);
  else if (res.status === 409) conflicts.add(1);
  else unexpected.add(1);

  check(res, { 'status is 200 or 409': (r) => r.status === 200 || r.status === 409 });
}
