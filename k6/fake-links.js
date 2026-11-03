import http from "k6/http";
import { check } from "k6";

export const options = { vus: 20, duration: "30s" };

export default function () {
  const code = `fake${Math.random().toString(36).slice(2)}`;
  const res = http.get(`http://host.docker.internal:3000/${code}`, {
    redirects: 0,
  });

  check(res, { "status is 404": (r) => r.status === 404 });
}
