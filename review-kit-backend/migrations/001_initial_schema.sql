CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    subscription JSONB DEFAULT '{"tier": "free", "status": "active", "currentPeriodEnd": null}'::jsonb,
    usage JSONB DEFAULT '{"chatsToday": 0, "importsToday": 0, "lastResetDate": null}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    linked_accounts JSONB DEFAULT '{}'::jsonb,
    last_analysis JSONB,
    is_syncing BOOLEAN DEFAULT FALSE,
    sync_stage TEXT DEFAULT 'idle',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    external_id TEXT,
    author TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    text TEXT,
    review_date TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL, 
    url TEXT,
    tags TEXT[],
    assigned_to TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(location_id, external_id, source)
);

CREATE TABLE IF NOT EXISTS portal_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, 
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portal_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(location_id, platform)
);

CREATE INDEX idx_locations_user_id ON locations(user_id);
CREATE INDEX idx_reviews_location_id ON reviews(location_id);
CREATE INDEX idx_reviews_source ON reviews(source);
CREATE INDEX idx_reviews_date ON reviews(review_date DESC);
CREATE INDEX idx_portal_clicks_location_id ON portal_clicks(location_id);
CREATE INDEX idx_portal_urls_location_id ON portal_urls(location_id);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_urls ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see/edit their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Locations: Users can only access their own locations
CREATE POLICY "Users can view own locations"
    ON locations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own locations"
    ON locations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own locations"
    ON locations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own locations"
    ON locations FOR DELETE
    USING (auth.uid() = user_id);


CREATE POLICY "Users can view reviews for own locations"
    ON reviews FOR SELECT
    USING (
        location_id IN (
            SELECT id FROM locations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert reviews for own locations"
    ON reviews FOR INSERT
    WITH CHECK (
        location_id IN (
            SELECT id FROM locations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update reviews for own locations"
    ON reviews FOR UPDATE
    USING (
        location_id IN (
            SELECT id FROM locations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete reviews for own locations"
    ON reviews FOR DELETE
    USING (
        location_id IN (
            SELECT id FROM locations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage portal URLs for own locations"
    ON portal_urls FOR ALL
    USING (
        location_id IN (
            SELECT id FROM locations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can insert portal clicks"
    ON portal_clicks FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can view clicks for own locations"
    ON portal_clicks FOR SELECT
    USING (
        location_id IN (
            SELECT id FROM locations WHERE user_id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portal_urls_updated_at
    BEFORE UPDATE ON portal_urls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;