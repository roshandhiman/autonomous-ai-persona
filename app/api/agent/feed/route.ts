import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    let agentId = url.searchParams.get('agentId');

    // If no agentId is provided, fallback to fetching the first agent
    // (useful if you're building a simple single-agent UI)
    if (!agentId) {
      const { data: firstAgent } = await supabase.from('agents').select('id').limit(1).single();
      if (!firstAgent) {
        return NextResponse.json({ posts: [] }, { status: 200 });
      }
      agentId = firstAgent.id;
    }

    const { data, error } = await supabase
      .from('posts')
      .select('id, text, rationale, sources, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching feed:', error);
      return NextResponse.json({ posts: [] }, { status: 200 });
    }

    // Format strictly as requested
    const posts = data.map((post) => ({
      id: post.id,
      createdAt: new Date(post.created_at).toISOString(),
      text: post.text,
      rationale: post.rationale,
      sources: post.sources
    }));

    return NextResponse.json({ posts }, { status: 200 });

  } catch (error) {
    console.error('Feed API error:', error);
    return NextResponse.json({ posts: [] }, { status: 200 });
  }
}
