import { createClient } from '@supabase/supabase-js';

// Reemplazá esto con tu URL y tu Anon Key reales de Supabase
const supabaseUrl = 'https://pdlpwnjouhjbyfvkhbsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkbHB3bmpvdWhqYnlmdmtoYnNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTU0NTYsImV4cCI6MjA4Nzk3MTQ1Nn0.A9ckVcQokdLJhWcKqOiiPAucZLxEWBOHnEd8_ZwPMlE';

export const supabase = createClient(supabaseUrl, supabaseKey);