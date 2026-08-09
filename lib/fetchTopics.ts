export interface Topic {
  title: string;
  url: string;
  points: number;
  source: string;
  summary: string;
  publishedAt: string;
}

const FRESH_WINDOW_MS = 72 * 60 * 60 * 1000;

const NEWS_QUERIES = [
  'AI security OR artificial intelligence security OR prompt injection',
  'artificial intelligence OR generative AI OR machine learning',
  'LLM vulnerability OR AI regulation OR AI safety',
  'OpenAI OR Anthropic OR Google DeepMind OR Meta AI OR Microsoft AI',
];

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function stripTags(value: string) {
  return decodeXml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? stripTags(match[1]) : '';
}

function getAtomLink(block: string) {
  const href = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
  return href ? decodeXml(href) : '';
}

function parseFeed(xml: string, source: string): Topic[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];

  return blocks.map((block) => {
    const title = getTag(block, 'title');
    const url = getTag(block, 'link') || getAtomLink(block) || getTag(block, 'id');
    const summary = getTag(block, 'description') || getTag(block, 'summary') || getTag(block, 'content');
    const publishedAt = getTag(block, 'pubDate') || getTag(block, 'published') || getTag(block, 'updated');

    return {
      title,
      url,
      points: 0,
      source,
      summary,
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
    };
  }).filter((topic) => topic.title && topic.url);
}

async function fetchRss(url: string, source: string): Promise<Topic[]> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'AdaAutonomousPersona/1.0',
      },
    });

    if (!response.ok) return [];
    return parseFeed(await response.text(), source);
  } catch (error) {
    console.error(`Error fetching ${source}:`, error);
    return [];
  }
}

async function fetchHackerNews(domain: string): Promise<Topic[]> {
  const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const query = encodeURIComponent(`${domain} AI security LLM`);
  const url = `https://hn.algolia.com/api/v1/search?query=${query}&tags=story&numericFilters=created_at_i>${twentyFourHoursAgo}`;

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return [];

    const data = await response.json();
    return data.hits.map((hit: any) => ({
      title: hit.title,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      points: hit.points || 0,
      source: 'Hacker News',
      summary: hit.story_text || '',
      publishedAt: hit.created_at,
    })).filter((topic: Topic) => topic.title && topic.url);
  } catch (error) {
    console.error('Error fetching Hacker News:', error);
    return [];
  }
}

export async function fetchTopics(domain: string): Promise<Topic[]> {
  const googleFeeds = NEWS_QUERIES.map((query) => {
    const fullQuery = `${query} ${domain}`;
    return {
      source: 'Google News',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}+when:3d&hl=en-US&gl=US&ceid=US:en`,
    };
  });

  const arxivFeeds = [
    {
      source: 'arXiv cs.AI/cs.CR/cs.LG',
      url: 'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CR+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=20',
    },
  ];

  const results = await Promise.allSettled([
    ...googleFeeds.map((feed) => fetchRss(feed.url, feed.source)),
    ...arxivFeeds.map((feed) => fetchRss(feed.url, feed.source)),
    fetchHackerNews(domain),
  ]);

  const cutoff = Date.now() - FRESH_WINDOW_MS;
  const seen = new Set<string>();

  return results
    .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .filter((topic) => {
      const published = new Date(topic.publishedAt).getTime();
      const key = topic.url || topic.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return Number.isFinite(published) && published >= cutoff;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 40);
}
