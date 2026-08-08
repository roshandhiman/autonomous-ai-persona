import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchTopics } from '@/lib/fetchTopics';
import { generatePost } from '@/lib/generatePost';

// This would be triggered by a Cron job (like Vercel Cron)
export async function POST(request: Request) {
  try {
    // 1. Secret token protection
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (secret !== process.env.TICK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the body to get the agentId. Alternatively, if your tick only processes 
    // a single global agent, you could fetch the agent from the DB without passing it.
    // Assuming we pass { "agentId": "..." } in the body for the cron.
    const body = await request.json().catch(() => ({}));
    let { agentId } = body;

    // If agentId isn't provided, try to fetch the first agent as a fallback 
    // (useful for simple setups where you only have one agent)
    if (!agentId) {
      const { data: firstAgent } = await supabase.from('agents').select('id, domain').limit(1).single();
      if (!firstAgent) {
        return NextResponse.json({ status: 'No agents found to tick.' }, { status: 200 });
      }
      agentId = firstAgent.id;
    }

    // Get the agent domain
    const { data: agent } = await supabase.from('agents').select('domain').eq('id', agentId).single();
    if (!agent) {
      return NextResponse.json({ status: `Agent ${agentId} not found.` }, { status: 200 });
    }

    // 2. Fetch Topics
    const topics = await fetchTopics(agent.domain);
    if (topics.length === 0) {
      return NextResponse.json({ status: 'No new topics found.' }, { status: 200 });
    }

    // 3. Generate Post (Judge + Write)
    const result = await generatePost(topics, agentId);
    
    if (!result) {
      return NextResponse.json({ status: 'Generation skipped or failed (no result).' }, { status: 200 });
    }

    // 4. Save the results based on decision
    if (result.decision === 'publish') {
      // Insert the actual post
      const { error: postError } = await supabase.from('posts').insert({
        agent_id: agentId,
        text: result.text,
        rationale: result.rationale,
        sources: result.sources,
        topic: result.topic,
      });

      if (postError) console.error('Failed to insert post:', postError);

      // Also record that we've seen and published this topic
      await supabase.from('seen_topics').insert({
        agent_id: agentId,
        topic_title: result.topic,
        decision: 'published',
        reason: 'Chosen for publishing.'
      });

      return NextResponse.json({ status: 'Published', topic: result.topic }, { status: 200 });

    } else {
      // Record the rejection to avoid reconsidering it
      const { error: rejectError } = await supabase.from('seen_topics').insert({
        agent_id: agentId,
        topic_title: result.topic,
        decision: 'rejected',
        reason: result.rejectionReason || 'Rejected by persona.',
      });

      if (rejectError) console.error('Failed to insert rejection:', rejectError);

      return NextResponse.json({ status: 'Rejected', reason: result.rejectionReason }, { status: 200 });
    }

  } catch (error) {
    // Return 200 so the cron doesn't excessively retry on a known bug, but log the error.
    console.error('Tick processing error:', error);
    return NextResponse.json(
      { status: 'Error during tick execution', error: String(error) }, 
      { status: 200 }
    );
  }
}
