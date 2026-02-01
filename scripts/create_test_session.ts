
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    const JOIN_CODE = 'TEST01';
    const USER_ID = '93c46300-57eb-48c8-b35c-cc49c76cfa66';

    const { data, error } = await supabase
        .from('erg_sessions')
        .insert({
            join_code: JOIN_CODE,
            status: 'active',
            created_by: USER_ID,
            race_state: 0
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create session:', error);
    } else {
        console.log(`Created Session: ${data.id}`);
    }
}

main();
