import { supabase } from '@/lib/supabase';
import { Topic } from '@/lib/fetchTopics';

interface ReviewedTopic {
  topic: string;
  decision: 'published' | 'rejected';
  reason: string;
}

interface GenerateResponse {
  decision: 'publish' | 'reject';
  topic: string;
  text: string;
  rationale: string;
  sources: string[];
  rejectionReason: string;
  reviewedTopics: ReviewedTopic[];
}

const SECURITY_TERMS = [
  'security', 'vulnerability', 'exploit', 'breach', 'jailbreak', 'prompt injection',
  'adversarial', 'poisoning', 'privacy', 'leak', 'safety', 'alignment', 'red team',
  'malware', 'ransomware', 'backdoor', 'cryptography', 'eval', 'benchmark',
];

const AI_TERMS = [
  'ai', 'artificial intelligence', 'llm', 'large language model', 'machine learning',
  'model', 'agent', 'openai', 'anthropic', 'deepmind', 'mistral', 'meta', 'nvidia',
  'robotics', 'inference', 'training', 'dataset',
];

const REJECT_TERMS = [
  'coupon', 'sale', 'stock market', 'price target', 'celebrity', 'sports',
  'horoscope', 'top 10', 'crypto price',
];

function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function scoreTopic(topic: Topic) {
  const text = `${topic.title} ${topic.summary}`.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  if (includesAny(text, AI_TERMS)) {
    score += 4;
    reasons.push('direct AI/technology relevance');
  }

  if (includesAny(text, SECURITY_TERMS)) {
    score += 5;
    reasons.push('security or safety implications');
  }

  if (topic.source === 'Hacker News') score += 1;
  if (topic.source.startsWith('arXiv')) score += 2;
  if (topic.points > 20) score += Math.min(3, Math.floor(topic.points / 50) + 1);

  const ageHours = (Date.now() - new Date(topic.publishedAt).getTime()) / (60 * 60 * 1000);
  if (ageHours <= 24) {
    score += 3;
    reasons.push('published within the last 24 hours');
  } else if (ageHours <= 72) {
    score += 1;
    reasons.push('still inside the 72 hour freshness window');
  }

  if (includesAny(text, REJECT_TERMS)) {
    score -= 6;
    reasons.push('contains low-signal consumer or market noise');
  }

  if (!topic.summary && topic.title.length < 35) score -= 1;

  return {
    score,
    reason: reasons.length ? reasons.join(', ') : 'low topical signal',
  };
}

function buildPost(topic: Topic) {
  const summary = topic.summary
    ? ` The useful signal: ${topic.summary.slice(0, 180).replace(/\s+\S*$/, '')}.`
    : '';

  return [
    `${topic.title}`,
    '',
    `Ada's read: this is worth watching because it sits close to the failure modes that matter in real systems, not the usual "AI changes everything" wallpaper.${summary}`,
    '',
    'The security question is simple: what new capability, dependency, or attack surface did this introduce, and who can verify the claims under adversarial pressure?',
  ].join('\n');
}

export async function generatePost(topics: Topic[], agentId: string): Promise<GenerateResponse | null> {
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('topic')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(12);

  const { data: seenTopics } = await supabase
    .from('seen_topics')
    .select('topic_title, decision')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(80);

  const recentPostTitles = new Set((recentPosts || []).map((post) => post.topic.toLowerCase()));
  const seenTopicTitles = new Set((seenTopics || []).map((seen) => seen.topic_title.toLowerCase()));

  const novelTopics = topics.filter((topic) => {
    const title = topic.title.toLowerCase();
    return !seenTopicTitles.has(title) && !recentPostTitles.has(title);
  });

  if (novelTopics.length === 0) {
    return null;
  }

  const judged = novelTopics.map((topic) => ({
    topic,
    ...scoreTopic(topic),
  })).sort((a, b) => b.score - a.score);

  const selected = judged[0];
  const rejected = judged.slice(1, 8).map((candidate) => ({
    topic: candidate.topic.title,
    decision: 'rejected' as const,
    reason: `Rejected: ${candidate.reason}; score ${candidate.score} was weaker than the selected candidate.`,
  }));

  if (!selected || selected.score < 6) {
    return {
      decision: 'reject',
      topic: selected?.topic.title || novelTopics[0].title,
      text: '',
      rationale: '',
      sources: selected ? [selected.topic.url] : [],
      rejectionReason: selected
        ? `Rejected all candidates. Best candidate scored ${selected.score}: ${selected.reason}. Ada requires fresh AI/technology signal with technical, security, or safety consequences.`
        : 'Rejected all candidates because no publishable topics were available.',
      reviewedTopics: [
        {
          topic: selected?.topic.title || novelTopics[0].title,
          decision: 'rejected',
          reason: selected?.reason || 'No publishable signal.',
        },
        ...rejected,
      ],
    };
  }

  const alternatives = rejected.slice(0, 3).map((item) => item.topic).join('; ') || 'lower-signal candidates';

  return {
    decision: 'publish',
    topic: selected.topic.title,
    text: buildPost(selected.topic),
    rationale: `Selected because it has ${selected.reason}. It is relevant now because it was published at ${selected.topic.publishedAt} from ${selected.topic.source}, inside the live discovery window. Chosen over ${alternatives} because Ada prioritizes technically consequential AI/security developments over generic product noise.`,
    sources: [selected.topic.url],
    rejectionReason: '',
    reviewedTopics: [
      {
        topic: selected.topic.title,
        decision: 'published',
        reason: `Published: ${selected.reason}; score ${selected.score}.`,
      },
      ...rejected,
    ],
  };
}
