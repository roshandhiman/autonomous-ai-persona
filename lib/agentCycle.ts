import { fetchTopics } from '@/lib/fetchTopics';
import { generatePost } from '@/lib/generatePost';
import { supabase } from '@/lib/supabase';

export const PUBLISH_INTERVAL_MS = 15 * 60 * 1000;

export async function shouldRunAgent(agentId: string) {
  const { data: lastSeen } = await supabase
    .from('seen_topics')
    .select('created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastSeen?.created_at) return true;

  return Date.now() - new Date(lastSeen.created_at).getTime() >= PUBLISH_INTERVAL_MS;
}

export async function runAgentCycle(agentId: string) {
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, domain')
    .eq('id', agentId)
    .single();

  if (agentError || !agent) {
    return { status: 'Agent not found', published: false };
  }

  const topics = await fetchTopics(agent.domain);
  if (topics.length === 0) {
    return { status: 'No live topics found', published: false };
  }

  const result = await generatePost(topics, agentId);
  if (!result) {
    return { status: 'No novel topics found', published: false };
  }

  if (result.decision === 'publish') {
    const { error: postError } = await supabase.from('posts').insert({
      agent_id: agentId,
      text: result.text,
      rationale: result.rationale,
      sources: result.sources,
      topic: result.topic,
    });

    if (postError) {
      console.error('Failed to insert post:', postError);
      return { status: 'Failed to save post', published: false };
    }
  }

  const reviewedRows = result.reviewedTopics.map((review) => ({
    agent_id: agentId,
    topic_title: review.topic,
    decision: review.decision,
    reason: review.reason || result.rejectionReason || 'Reviewed by Ada.',
  }));

  if (reviewedRows.length > 0) {
    const { error: seenError } = await supabase.from('seen_topics').insert(reviewedRows);
    if (seenError) console.error('Failed to save reviewed topics:', seenError);
  }

  return {
    status: result.decision === 'publish' ? 'Published' : 'Rejected',
    published: result.decision === 'publish',
    topic: result.topic,
    reason: result.rejectionReason,
  };
}
