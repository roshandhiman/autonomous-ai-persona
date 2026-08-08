import { supabase } from '@/lib/supabase';
import { ADA_PERSONA } from '@/lib/persona';
import { Topic } from '@/lib/fetchTopics';

interface GenerateResponse {
  decision: 'publish' | 'reject';
  topic: string;
  text: string;
  rationale: string;
  sources: string[];
  rejectionReason: string;
}

export async function generatePost(topics: Topic[], agentId: string): Promise<GenerateResponse | null> {
  try {
    // 1. Fetch context to avoid duplicates
    // Get last 5 published posts
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('topic')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recently seen topics (whether rejected or published)
    const { data: seenTopics } = await supabase
      .from('seen_topics')
      .select('topic_title, decision')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(20);

    const recentPostTitles = recentPosts?.map((p) => p.topic) || [];
    const seenTopicTitles = seenTopics?.map((s) => s.topic_title) || [];

    // Filter out candidate topics that are already exactly in seenTopics to save tokens, 
    // though the LLM will also make a judgment.
    const novelTopics = topics.filter(t => !seenTopicTitles.includes(t.title));

    if (novelTopics.length === 0) {
      console.log('No novel topics found to process.');
      return null;
    }

    // 2. Build the Prompt for Groq
    const systemPrompt = `
${ADA_PERSONA.systemPrompt}

You will be provided with a list of recent AI-related news/stories (Candidate Topics) and a list of topics you have recently seen or posted about.
Your task is to act as the persona, review the Candidate Topics, and decide if ONE of them is worth publishing a post about.

You must output your response in STRICT JSON format matching this schema:
{
  "decision": "publish" | "reject",
  "topic": "The exact title of the chosen topic from the candidates",
  "text": "The actual post content written in your persona's voice (only if decision is publish)",
  "rationale": "Why you selected this, why it is relevant now, and why you chose it over the alternatives",
  "sources": ["The URL of the chosen topic"],
  "rejectionReason": "If decision is reject, explain why none of the candidates met your standards."
}
`;

    const userPrompt = `
Recent posts you made: ${JSON.stringify(recentPostTitles)}
Recently reviewed topics: ${JSON.stringify(seenTopicTitles)}

Candidate Topics to evaluate:
${JSON.stringify(novelTopics, null, 2)}
`;

    // 3. Call Groq API (using fetch to standard OpenAI-compatible endpoint)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API Error:', errText);
      return null;
    }

    const data = await response.json();
    const resultText = data.choices[0]?.message?.content;

    if (!resultText) {
      console.error('No content returned from Groq');
      return null;
    }

    // 4. Parse and return
    const parsedResult = JSON.parse(resultText) as GenerateResponse;
    return parsedResult;

  } catch (error) {
    console.error('Error in generatePost:', error);
    return null;
  }
}
