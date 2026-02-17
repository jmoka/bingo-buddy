import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://vqvnodwojefubbbnbyar.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdm5vZHdvamVmdWJiYm5ieWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjkzNjksImV4cCI6MjA4NjkwNTM2OX0.fDEqqVZXw9TLnVOzsWRoEaKdngtrm-fJRbPtDLO1tLU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);