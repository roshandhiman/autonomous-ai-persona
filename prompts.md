UI/UX : 


I'm building a frontend for an autonomous AI persona feed — think a premium 
Twitter/LinkedIn-style feed but for an AI tech persona that posts on its own.

Design a UI concept with:
- Color palette: white, black, and orange (accent) — premium, high-end tech 
  product feel, not playful/toylike
- Both light mode and dark mode variants
- Typography: modern, clean sans-serif, strong hierarchy
- Layout: a feed of post cards, each showing:
  - Persona name + avatar/icon + domain tag (e.g. "Ada — AI Security Researcher")
  - Post text (main content)
  - A distinct "rationale" section per post — why this topic, why now, 
    source links — styled subtly different from main text (like a footnote 
    or expandable panel) so it doesn't compete visually with the post
  - Timestamp
  - Source links, styled as small clickable chips or underlined text
- Header: persona name, domain, live status indicator ("actively publishing")
- Empty state design (when no posts yet)
- Should feel premium/enterprise, like a polished SaaS dashboard — not 
  generic Bootstrap look

Give me 2-3 design direction options with color usage examples (hex codes) 
and layout structure before we lock one.


Frontend:


I'm building the frontend for a hackathon project called "Autonomous AI 
Creator" — an AI agent that acts as a tech/AI persona (e.g. "Ada, AI 
Security Researcher") and publishes posts on its own over time, without 
human prompting.

Context: My teammate is building the backend (Next.js API routes + 
Supabase). I only need the FRONTEND. It will call one API endpoint:

GET /api/agent/feed?agentId=abc-123

Response shape (always this exact structure):
{
  "posts": [
    {
      "id": "p7",
      "createdAt": "2026-08-07T10:30:00Z",
      "text": "the post content",
      "rationale": "why this topic was picked, why relevant now",
      "sources": ["https://example.com"]
    }
  ]
}

Build a single-page React/Next.js frontend that:
1. Fetches this feed on load and polls it every 30-60 seconds for new posts 
   (auto-refresh without full page reload)
2. Displays posts as cards, newest first, each showing text, timestamp 
   (formatted human-readable), a visually distinct rationale section, and 
   clickable source links
3. Has a header with persona name/domain and a "live" indicator
4. Has a light/dark mode toggle
5. Color theme: white, black, orange accent — premium enterprise feel, not 
   playful
6. Handles empty state (no posts yet) and loading state gracefully
7. Use placeholder/mock data matching the exact JSON shape above so I can 
   build now and swap in the real API URL later — put the API URL in a 
   single config variable at the top of the file so it's a one-line change

Keep it a single clean file/component structure, use Tailwind for styling.


Backend :


1st prompot for bakcend antigravity :-I'm building the BACKEND for a hackathon project called "Autonomous AI Creator" 
— an AI agent that acts as a tech/AI persona (e.g. "Ada, AI Security Researcher") 
and autonomously publishes posts about AI/tech topics over time, without any 
human triggering it per-post.

Stack: Next.js (App Router, API routes), Supabase (Postgres) for DB, Groq API 
(Llama 3.3 70B) for LLM calls, deployed on Vercel. My teammate is building the 
frontend separately in the same repo (app/page.tsx) — I only need backend code 
under app/api/.

Build this in the following order, and show me each step so I can test before 
moving to the next:

STEP 1 — Supabase schema
Give me SQL to create these tables:
- agents (id uuid pk, name text, domain text, created_at timestamptz default now())
- posts (id uuid pk, agent_id uuid references agents, text text, rationale text, 
  sources jsonb, topic text, created_at timestamptz default now())
- seen_topics (id uuid pk, agent_id uuid references agents, topic_title text, 
  decision text check in ('published','rejected'), reason text, created_at 
  timestamptz default now())

STEP 2 — Persona config
Create lib/persona.ts exporting a fixed persona system prompt for "Ada, an AI 
Security Researcher" — include: tone (direct, technical, slightly opinionated), 
3-4 stable stances/opinions about AI security, what she considers low-quality 
and rejects (marketing fluff, hype without technical depth, repeated topics, 
non-security-relevant news).

STEP 3 — POST /api/agent/init
Accepts { persona: { name, domain } } in body, inserts into agents table, 
returns { agentId }.

STEP 4 — Topic discovery function
lib/fetchTopics.ts — fetch recent stories from Hacker News Algolia API 
(https://hn.algolia.com/api/v1/search?query=<domain-keywords>&tags=story) 
filtered to last 24 hours, return array of { title, url, points }.

STEP 5 — Judge + Writer function
lib/generatePost.ts — takes topics array + agentId. First query seen_topics 
and last 5 posts for this agent (for dedup context). Then call Groq API with 
the persona system prompt, the candidate topics, and recent post history. 
Ask it to return STRICT JSON:
{
  "decision": "publish" | "reject",
  "topic": "...",
  "text": "the post content in persona voice",
  "rationale": "why selected, why relevant now, why chosen over alternatives",
  "sources": ["url"],
  "rejectionReason": "if rejected, why"
}
Use Groq's JSON mode / response_format if available. Handle parse errors 
gracefully with try/catch.

STEP 6 — POST /api/agent/tick (internal, protected by a secret token in 
header or query param, e.g. ?secret=XXXX, reject with 401 if missing/wrong)
Chain: fetch topics → generatePost → if decision is "publish", insert into 
posts table; if "reject", insert into seen_topics with decision='rejected' 
and the reason. Wrap everything in try/catch so a failure never crashes — 
just log and return a 200 with status info, so cron retries cleanly next run.

STEP 7 — GET /api/agent/feed
Query param agentId. Query posts table where agent_id = agentId, order by 
created_at DESC. Return exactly:
{
  "posts": [
    {
      "id": "...",
      "createdAt": "ISO 8601 UTC string",
      "text": "...",
      "rationale": "...",
      "sources": ["..."]
    }
  ]
}
If no posts, return { "posts": [] }. Never error.

STEP 8 — .env.example
List required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, 
TICK_SECRET.

Build this incrementally, step by step, and explain each file you create. 
Use TypeScript. Keep code clean and readable, no unnecessary abstraction — 
this needs to be built and working within a few hours.
