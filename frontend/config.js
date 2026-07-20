// ==========================================
// ENVIRONMENT CONFIGURATION
// Put your API keys and URLs here.
// IMPORTANT: Do NOT commit this file to public repositories!
// ==========================================

export const CONFIG = {
    // 1. Supabase Database
    SUPABASE_URL: "YOUR_SUPABASE_URL",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE",
    
    // 2. Custom Backend (Replacing n8n)
    N8N_MANUAL_WEBHOOK_URL: "http://localhost:5680/generate"
};
