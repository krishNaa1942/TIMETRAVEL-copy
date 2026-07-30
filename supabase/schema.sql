-- =====================================================================
-- Time Travel – Supabase PostgreSQL Schema
-- =====================================================================
-- Run this in Supabase SQL Editor (or via psql) to create all tables.
-- Alternatively, the Flask app creates tables automatically on startup
-- via SQLAlchemy's create_all().
--
-- This script also enables Row Level Security (RLS) on user-owned
-- tables so each user can only access their own data.
-- =====================================================================

-- ── Users ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(128)  NOT NULL,
    email       VARCHAR(256)  NOT NULL UNIQUE,
    password_hash VARCHAR(256) NOT NULL,
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ── Destinations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS destinations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(128)  NOT NULL UNIQUE,
    country         VARCHAR(64)   NOT NULL DEFAULT 'India',
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    safety_score    DOUBLE PRECISION,
    avg_daily_cost  DOUBLE PRECISION,
    best_season     VARCHAR(64),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_destinations_name ON destinations (name);

-- ── Trip Queries ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_queries (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    user_session    VARCHAR(64),
    destination     VARCHAR(128) NOT NULL,
    num_days        INTEGER      NOT NULL DEFAULT 1,
    family_size     INTEGER      NOT NULL DEFAULT 1,
    travel_class    VARCHAR(16)  DEFAULT 'economy',
    estimated_budget DOUBLE PRECISION,
    accommodation   DOUBLE PRECISION,
    food            DOUBLE PRECISION,
    transport       DOUBLE PRECISION,
    activities      DOUBLE PRECISION,
    miscellaneous   DOUBLE PRECISION,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trip_queries_user ON trip_queries (user_id);
CREATE INDEX IF NOT EXISTS idx_trip_queries_session ON trip_queries (user_session);

-- ── Chat Messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    user_session    VARCHAR(64),
    role            VARCHAR(16)  NOT NULL,
    message         TEXT         NOT NULL,
    detected_intent VARCHAR(64),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (user_session);

-- ── Favorites ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id),
    item_type   VARCHAR(32)  NOT NULL DEFAULT 'destination',
    item_name   VARCHAR(256) NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (user_id, item_type, item_name)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id);

-- ── Travel Notes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS travel_notes (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id),
    destination VARCHAR(128) NOT NULL,
    title       VARCHAR(256) NOT NULL,
    content     TEXT         NOT NULL,
    mood        VARCHAR(32),
    rating      INTEGER,
    is_public   BOOLEAN      DEFAULT FALSE,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_travel_notes_user ON travel_notes (user_id);

-- ── Shared Trips ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_trips (
    id              SERIAL PRIMARY KEY,
    share_token     VARCHAR(36) NOT NULL UNIQUE,
    user_id         INTEGER     NOT NULL REFERENCES users(id),
    trip_id         INTEGER     REFERENCES trip_queries(id),
    title           VARCHAR(256) NOT NULL DEFAULT 'My Trip',
    itinerary_json  TEXT,
    notes           TEXT,
    is_active       BOOLEAN     DEFAULT TRUE,
    view_count      INTEGER     DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shared_trips_token ON shared_trips (share_token);
CREATE INDEX IF NOT EXISTS idx_shared_trips_user ON shared_trips (user_id);

-- ── Expenses ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id),
    trip_id     INTEGER      REFERENCES trip_queries(id),
    destination VARCHAR(128) NOT NULL,
    category    VARCHAR(64)  NOT NULL,
    description VARCHAR(256) NOT NULL,
    amount      DOUBLE PRECISION NOT NULL,
    currency    VARCHAR(8)   DEFAULT 'INR',
    date        DATE,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses (user_id);

-- ── Packing Items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packing_items (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id),
    destination VARCHAR(128) NOT NULL,
    item_text   VARCHAR(256) NOT NULL,
    is_checked  BOOLEAN      DEFAULT FALSE,
    is_custom   BOOLEAN      DEFAULT FALSE,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_packing_items_user ON packing_items (user_id);

-- ── Trips ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES users(id),
    title           VARCHAR(256) NOT NULL,
    destination     VARCHAR(128) NOT NULL,
    start_date      DATE,
    end_date        DATE,
    num_days        INTEGER      DEFAULT 1,
    family_size     INTEGER      DEFAULT 1,
    travel_class    VARCHAR(16)  DEFAULT 'economy',
    cover_image_url VARCHAR(512),
    status          VARCHAR(20)  DEFAULT 'planning',
    budget_total    DOUBLE PRECISION,
    notes           TEXT,
    itinerary_json  TEXT,
    is_public       BOOLEAN      DEFAULT FALSE,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trips_user ON trips (user_id);

-- ── Trip Days ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_days (
    id          SERIAL PRIMARY KEY,
    trip_id     INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_number  INTEGER NOT NULL,
    date        DATE,
    title       VARCHAR(256),
    notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_trip_days_trip ON trip_days (trip_id);

-- ── Trip Places ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_places (
    id              SERIAL PRIMARY KEY,
    trip_id         INTEGER      NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_id          INTEGER      REFERENCES trip_days(id) ON DELETE CASCADE,
    name            VARCHAR(256) NOT NULL,
    address         VARCHAR(512),
    lat             DOUBLE PRECISION,
    lon             DOUBLE PRECISION,
    category        VARCHAR(64),
    notes           TEXT,
    start_time      VARCHAR(16),
    end_time        VARCHAR(16),
    duration_minutes INTEGER,
    estimated_cost  DOUBLE PRECISION,
    position_order  INTEGER      DEFAULT 0,
    is_booked       BOOLEAN      DEFAULT FALSE,
    rating          DOUBLE PRECISION,
    image_url       VARCHAR(512),
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trip_places_trip ON trip_places (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_places_day ON trip_places (day_id);

-- ── Reservations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
    id                SERIAL PRIMARY KEY,
    trip_id           INTEGER      NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id           INTEGER      NOT NULL REFERENCES users(id),
    res_type          VARCHAR(32)  NOT NULL,
    title             VARCHAR(256) NOT NULL,
    confirmation_code VARCHAR(128),
    provider          VARCHAR(128),
    start_datetime    TIMESTAMPTZ,
    end_datetime      TIMESTAMPTZ,
    location          VARCHAR(256),
    notes             TEXT,
    amount            DOUBLE PRECISION,
    currency          VARCHAR(8)   DEFAULT 'INR',
    status            VARCHAR(20)  DEFAULT 'confirmed',
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservations_trip ON reservations (trip_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations (user_id);

-- ── Trip Photos ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_photos (
    id            SERIAL PRIMARY KEY,
    trip_id       INTEGER      NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id       INTEGER      NOT NULL REFERENCES users(id),
    filename      VARCHAR(256) NOT NULL,
    original_name VARCHAR(256),
    caption       VARCHAR(512),
    place_name    VARCHAR(256),
    taken_at      TIMESTAMPTZ,
    file_size     INTEGER,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trip_photos_trip ON trip_photos (trip_id);

-- ── Trip Documents ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_documents (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER      NOT NULL REFERENCES users(id),
    trip_id       INTEGER      REFERENCES trips(id) ON DELETE CASCADE,
    doc_type      VARCHAR(32)  NOT NULL,
    title         VARCHAR(256) NOT NULL,
    filename      VARCHAR(256) NOT NULL,
    original_name VARCHAR(256),
    expiry_date   DATE,
    notes         TEXT,
    file_size     INTEGER,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trip_documents_user ON trip_documents (user_id);

-- ── Companions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companions (
    id           SERIAL PRIMARY KEY,
    trip_id      INTEGER      NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id      INTEGER      NOT NULL REFERENCES users(id),
    name         VARCHAR(128) NOT NULL,
    email        VARCHAR(256),
    phone        VARCHAR(32),
    role         VARCHAR(20)  DEFAULT 'traveler',
    avatar_color VARCHAR(16),
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companions_trip ON companions (trip_id);

-- ── Trip Templates ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_templates (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(256) NOT NULL,
    destination     VARCHAR(128) NOT NULL,
    num_days        INTEGER      NOT NULL,
    description     TEXT,
    template_json   TEXT         NOT NULL,
    category        VARCHAR(64),
    cover_image_url VARCHAR(512),
    popularity      INTEGER      DEFAULT 0,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Newsletter Subscribers ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(256) NOT NULL UNIQUE,
    subscribed_at TIMESTAMPTZ  DEFAULT NOW()
);


-- =====================================================================
-- Row Level Security (RLS)
-- =====================================================================
-- Enable RLS on user-owned tables so each user can only access their
-- own data when using the Supabase client with the anon key.
-- The service_role key bypasses RLS for server-side operations.
-- =====================================================================

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_queries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_trips      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips             ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_places       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE companions        ENABLE ROW LEVEL SECURITY;

-- Destinations and templates are public (read-only for everyone)
-- No RLS on destinations, trip_templates, newsletter_subscribers

-- ── User policies ─ owns their own row ──────────────────────────────
-- The Flask app MUST set `app.user_id` via `SELECT set_config('app.user_id', :uid, true)`
-- on every authenticated request. If unset, COALESCE defaults to -1 (no matches).
CREATE POLICY users_self ON users
    FOR ALL USING (id = COALESCE(NULLIF(current_setting('app.user_id', true), ''), '-1')::int);

-- ── Policies for user_id-owned tables ───────────────────────────────
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'trip_queries', 'chat_messages', 'favorites',
            'travel_notes', 'shared_trips', 'expenses',
            'packing_items', 'trips', 'reservations',
            'trip_photos', 'trip_documents', 'companions'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR ALL USING (user_id = COALESCE(NULLIF(current_setting(''app.user_id'', true), ''''), ''-1'')::int)',
            t || '_owner', t
        );
    END LOOP;
END $$;

-- Trip days & places are owned via their parent trip
CREATE POLICY trip_days_owner ON trip_days
    FOR ALL USING (
        trip_id IN (SELECT id FROM trips WHERE user_id = COALESCE(NULLIF(current_setting('app.user_id', true), ''), '-1')::int)
    );

CREATE POLICY trip_places_owner ON trip_places
    FOR ALL USING (
        trip_id IN (SELECT id FROM trips WHERE user_id = COALESCE(NULLIF(current_setting('app.user_id', true), ''), '-1')::int)
    );

-- Public travel notes (is_public = true) are readable by everyone
CREATE POLICY travel_notes_public ON travel_notes
    FOR SELECT USING (is_public = true);

-- Public shared trips (is_active = true) are readable by everyone
CREATE POLICY shared_trips_public ON shared_trips
    FOR SELECT USING (is_active = true);
