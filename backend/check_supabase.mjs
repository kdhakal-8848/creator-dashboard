import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
global.WebSocket = WebSocket;
dotenv.config({ path: '../.env' });
dotenv.config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL || "https://tbgkhbmsmdfpdcjnztvz.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZ2toYm1zbWRmcGRjam56dHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTY3NDIsImV4cCI6MjA5OTk5Mjc0Mn0.159ex2E4xtfQXd_UN4kdjRCkSIhTMARwWvs7iBUrrR0";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: posts } = await supabase.from('posts').select('*').order('updated_at', { ascending: false });
    const { data: brands, error: bErr } = await supabase.from('brands').select('*');
    console.log("Total posts in Supabase:", posts ? posts.length : 0);
    console.log("Total brands in Supabase:", brands ? brands.length : 0);
    if (brands && brands.length > 0) {
        console.log("\nBrands in Supabase:");
        console.dir(brands, { depth: null });
    }
}
check();
