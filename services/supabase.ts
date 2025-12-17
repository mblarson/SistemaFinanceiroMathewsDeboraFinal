
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

/**
 * Exportamos como supabaseClient para evitar conflitos com variáveis globais
 * injetadas por ferramentas externas ou extensões de navegador.
 */
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
