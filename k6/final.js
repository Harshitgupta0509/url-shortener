import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = "http://host.docker.internal:8080";
const redirectClicks = new Counter("redirect_clicks");

http.setResponseCallback(http.expectedStatuses(201, 302, 404));

export const options = {
  vus: 20,
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    "http_req_duration{name:redirect}": ["p(95)<100"],
  },
};

function createLink(region, url) {
  return http.post(`${BASE_URL}/api/links`, JSON.stringify({ url }), {
    headers: { "Content-Type": "application/json", "X-Region": region },
    tags: { name: "create" },
  });
}

export function setup() {
  const codes = [];

  for (let i = 0; i < 100; i++) {
    const region = i % 2 === 0 ? "india" : "us";
    const res = createLink(region, `https://example.com/setup/${i}`);
    codes.push(res.json("code"));
  }

  sleep(5);
  return { codes };
}

export default function (data) {
  const region = Math.random() < 0.5 ? "india" : "us";
  const action = Math.random();

  if (action < 0.9) {
    const code = data.codes[Math.floor(Math.random() * data.codes.length)];
    const res = http.get(`${BASE_URL}/${code}`, {
      redirects: 0,
      headers: { "X-Region": region },
      tags: { name: "redirect" },
    });

    if (check(res, { "redirect returns 302": (r) => r.status === 302 })) {
      redirectClicks.add(1);
    }
  } else if (action < 0.95) {
    const code = `fake${Math.random().toString(36).slice(2)}`;
    const res = http.get(`${BASE_URL}/${code}`, {
      redirects: 0,
      headers: { "X-Region": region },
      tags: { name: "fake" },
    });

    check(res, { "fake link returns 404": (r) => r.status === 404 });
  } else {
    const res = createLink(
      region,
      `https://example.com/load/${Date.now()}-${Math.random()}`,
    );

    check(res, { "create returns 201": (r) => r.status === 201 });
  }
}
