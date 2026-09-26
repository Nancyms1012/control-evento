import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ijqalxopeqyqfzwpfmfj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqcWFseG9wZXF5cWZ6d3BmbWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2OTk3ODksImV4cCI6MjEwMTI3NTc4OX0.aBusNxkym2JqjXRaKtgHPA-K1cywsb4CqK9NCRvpRw0';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
