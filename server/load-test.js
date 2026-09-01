import http from "k6/http";
import { check, sleep } from "k6";

const baseURL = __ENV.BASE_URL || "http://localhost:5000";
const targetPath = __ENV.TARGET_PATH || "/api/status";
const authToken = __ENV.AUTH_TOKEN || "";

const headers = {
  "Content-Type": "application/json",
};

if (authToken) {
  headers.Authorization = `Bearer ${authToken}`;
}

const stages = __ENV.STAGES
  ? JSON.parse(__ENV.STAGES)
  : [
      { duration: "10s", target: 10 },
      { duration: "20s", target: 50 },
      { duration: "20s", target: 100 },
      { duration: "20s", target: 200 },
      { duration: "10s", target: 0 },
    ];

export const options = {
  stages,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const url = `${baseURL}${targetPath}`;
  const res = http.get(url, { headers });

  const successCode = (r) => r.status >= 200 && r.status < 300;
  const acceptableCode = (r) =>
    r.status === 200 ||
    r.status === 201 ||
    r.status === 204 ||
    r.status === 401 ||
    r.status === 403;

  check(res, {
    "request completed": acceptableCode,
    "request succeeded": successCode,
  });

  sleep(1);
}

/*
Usage examples:
  k6 run load-test.js
  k6 run -e TARGET_PATH=/api/tasks -e AUTH_TOKEN="<clerk-jwt>" load-test.js
  k6 run -e STAGES='[{"duration":"10s","target":10},{"duration":"20s","target":50}]' load-test.js

Notes:
- The default script measures the non-Gemini /api/status endpoint so it can run without Clerk auth.
- For protected task endpoints, pass a valid Clerk JWT as AUTH_TOKEN and set TARGET_PATH=/api/tasks.
- This avoids hitting Gemini and keeps the benchmark focused on Express + MongoDB performance.
*/
