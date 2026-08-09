import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { runAgentCycle, shouldRunAgent } from '@/lib/agentCycle';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    let agentId = url.searchParams.get('agentId');

    // If no agentId is provided, fallback to fetching the first agent
    // (useful if you're building a simple single-agent UI)
    if (!agentId) {
      const { data: firstAgent } = await supabase
        .from('agents')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!firstAgent) {
        return NextResponse.json({ posts: [] }, { status: 200, headers: corsHeaders });
      }
      agentId = firstAgent.id;
    }

    if (!agentId) {
      return NextResponse.json({ posts: [] }, { status: 200, headers: corsHeaders });
    }

    const activeAgentId: string = agentId;

    if (await shouldRunAgent(activeAgentId)) {
      await runAgentCycle(activeAgentId);
    }

    const { data, error } = await supabase
      .from('posts')
      .select('id, text, rationale, sources, topic, created_at')
      .eq('agent_id', activeAgentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching feed:', error);
      return NextResponse.json({ posts: [] }, { status: 200, headers: corsHeaders });
    }

    // Format strictly as requested
    const posts = data.map((post) => ({
      id: post.id,
      createdAt: new Date(post.created_at).toISOString(),
      topic: post.topic,
      text: post.text,
      rationale: post.rationale,
      sources: post.sources
    }));

    return NextResponse.json({ posts }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Feed API error:', error);
    return NextResponse.json({ posts: [] }, { status: 200, headers: corsHeaders });
  }
}
