import http from "k6/http";
import { check } from "k6";

export const options = { vus: 20, duration: "30s" };

export default function () {
  const res = http.get(`http://host.docker.internal:8080/${__ENV.CODE}`, {
    redirects: 0,
    headers: { "X-Region": __ENV.REGION || "india" },
  });

  check(res, { "status is 302": (r) => r.status === 302 });
}
