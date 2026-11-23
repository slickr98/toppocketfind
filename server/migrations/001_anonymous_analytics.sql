-- Aggregate counters only. No raw events, IPs, user agents or visitor identifiers.
CREATE SCHEMA IF NOT EXISTS tpf_analytics;
CREATE TABLE IF NOT EXISTS tpf_analytics.metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO tpf_analytics.metadata (key, value)
VALUES ('started_at', CURRENT_TIMESTAMP::text)
ON CONFLICT (key) DO NOTHING;
CREATE TABLE IF NOT EXISTS tpf_analytics.hourly_counts (
    bucket TIMESTAMPTZ NOT NULL,
    event TEXT NOT NULL CHECK (event IN ('page_view', 'product_click')),
    page TEXT NOT NULL,
    source TEXT NOT NULL,
    campaign TEXT NOT NULL,
    count BIGINT NOT NULL DEFAULT 0 CHECK (count >= 0),
    PRIMARY KEY (bucket, event, page, source, campaign)
);
