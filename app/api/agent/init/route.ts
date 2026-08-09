import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { runAgentCycle } from '@/lib/agentCycle';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { persona } = body;

    if (!persona || !persona.name || !persona.domain) {
      return NextResponse.json(
        { error: 'Missing required fields: persona.name and persona.domain are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data, error } = await supabase
      .from('agents')
      .insert({
        name: persona.name,
        domain: persona.domain,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to initialize agent.' },
        { status: 500, headers: corsHeaders }
      );
    }

    await runAgentCycle(data.id);

    return NextResponse.json({ agentId: data.id }, { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('API /agent/init error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
