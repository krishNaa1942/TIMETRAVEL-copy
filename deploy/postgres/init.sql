-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Example: create a read-only monitoring role (optional)
-- CREATE ROLE monitoring WITH LOGIN PASSWORD :'MONITOR_PASSWORD' INHERIT;
-- GRANT CONNECT ON DATABASE timetravel TO monitoring;
-- GRANT USAGE ON SCHEMA public TO monitoring;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring;
