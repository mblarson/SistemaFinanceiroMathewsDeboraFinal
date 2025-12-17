
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://bnhxmjcgyqwjombhrdks.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJuaHhtamNneXF3am9tYmhyZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDk3MDksImV4cCI6MjA4MDQyNTcwOX0.wg7k8DJhE29d24BzGwp5ltUx_x_4iXjQFOC55x3t4B8';

/**
 * FIX EXPLANATION:
 * The error "Identifier 'supabase' has already been declared" occurs because 
 * loading the library via CDN often attaches a global 'supabase' object to the window. 
 * Redeclaring 'let supabase' in the same scope causes a conflict.
 * 
 * SOLUTION: We name the instance 'supabaseClient' instead.
 */
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
