import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { runAgentCycle } from '@/lib/agentCycle';

export async function GET(request: Request) {
  return handleTick(request);
}

export async function POST(request: Request) {
  return handleTick(request);
}

async function handleTick(request: Request) {
  try {
    // 1. Secret token protection
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (secret !== process.env.TICK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let { agentId } = body;

    // If agentId isn't provided, try to fetch the first agent as a fallback 
    if (!agentId) {
      const { data: firstAgent } = await supabase.from('agents').select('id, domain').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!firstAgent) {
        return NextResponse.json({ status: 'No agents found to tick.' }, { status: 200 });
      }
      agentId = firstAgent.id;
    }

    const result = await runAgentCycle(agentId);
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Tick processing error:', error);
    return NextResponse.json(
      { status: 'Error during tick execution', error: String(error) }, 
      { status: 200 }
    );
  }
}
