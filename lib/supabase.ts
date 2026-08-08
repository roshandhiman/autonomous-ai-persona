import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// We use the service role key to bypass RLS since this is a backend-only process.
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
