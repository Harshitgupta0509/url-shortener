import http from "k6/http";
import { check } from "k6";

export const options = { vus: 20, duration: "30s" };

export default function () {
  const res = http.get(`http://host.docker.internal:3000/${__ENV.CODE}`, {
    redirects: 0,
  });

  check(res, { "status is 302": (r) => r.status === 302 });
}
