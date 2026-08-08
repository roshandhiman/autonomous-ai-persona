-- STEP 1: Supabase Schema

-- Create agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    rationale TEXT NOT NULL,
    sources JSONB NOT NULL,
    topic TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create seen_topics table
CREATE TABLE seen_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    topic_title TEXT NOT NULL,
    decision TEXT CHECK (decision IN ('published', 'rejected')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: Add indexes for better performance since we will query these often
CREATE INDEX idx_posts_agent_id_created_at ON posts(agent_id, created_at DESC);
CREATE INDEX idx_seen_topics_agent_id ON seen_topics(agent_id);
