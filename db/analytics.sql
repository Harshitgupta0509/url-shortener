CREATE TABLE clicks (
  event_id UUID PRIMARY KEY,
  code VARCHAR(16) NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  device TEXT NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX clicks_code_time_idx ON clicks (code, clicked_at);
