
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
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const args = process.argv.slice(2);
const JOIN_CODE = args[0];
const BOT_COUNT = parseInt(args[1] || '1', 10);

if (!JOIN_CODE) {
    console.error('Usage: npx tsx scripts/simulate_bots.ts <JOIN_CODE> [COUNT]');
    process.exit(1);
}

// Bot Class
class Bot {
    id: string | null = null;
    name: string;
    watts = 150;
    distance = 0;
    pace = 120; // 2:00/500m
    strokeRate = 24;
    status: 'ready' | 'active' | 'finished' = 'ready';

    // Race Control
    raceState = 0;
    rowing = false;

    constructor(index: number, initialState: number = 0) {
        this.name = `SimBot ${index + 1}`;
        // Randomize ability
        this.watts = 100 + Math.random() * 200; // 100-300W
        this.raceState = initialState;

        // Initialize rowing state based on race state
        // 8 = SET (Wait), 10 = FALSE START (Stop)
        if (this.raceState === 8 || this.raceState === 10) {
            this.rowing = false;
        } else {
            this.rowing = true;
        }
    }

    async join(sessionId: string) {
        console.log(`[${this.name}] Joining session ${sessionId}...`);
        const { data, error } = await supabase
            .from('erg_session_participants')
            .insert({
                session_id: sessionId,
                display_name: this.name,
                status: 'ready',
                data: { watts: 0, distance: 0, pace: 0, strokeRate: 0 }
            })
            .select()
            .single();

        if (error) {
            console.error(`[${this.name}] Failed to join:`, error.message);
            return false;
        }

        this.id = data.id;
        console.log(`[${this.name}] Joined! ID: ${this.id}`);
        return true;
    }

    updatePhysics(dt: number) {
        if (!this.rowing) {
            this.runIdlePhysics();
            return;
        }

        // Vary watts slightly
        const variance = (Math.random() - 0.5) * 10;
        this.watts = Math.max(50, this.watts + variance);

        // Calculate Pace (Watts = 2.8 / (pace_seconds/500)^3 ) approx
        // Pace = (2.8/Watts)^(1/3) * 500
        const paceSeconds = Math.pow(2.8 / this.watts, 1 / 3) * 500;
        this.pace = paceSeconds;

        // Distance = (500 / pace) * dt
        const speed = 500 / paceSeconds; // m/s
        this.distance += speed * dt;

        // Stroke rate variance
        this.strokeRate = 24 + Math.sin(Date.now() / 1000) * 2;
    }

    runIdlePhysics() {
        this.watts = 0;
        this.strokeRate = 0;
        this.pace = 0;
    }

    getData() {
        return {
            watts: Math.round(this.watts),
            distance: Math.round(this.distance),
            pace: this.pace, // seconds per 500m
            strokeRate: Math.round(this.strokeRate),
            elapsedTime: 0, // Not tracked perfectly here
            calories: 0
        };
    }

    handleRaceState(state: number) {
        if (this.raceState === state) return;
        this.raceState = state;

        console.log(`[${this.name}] Race State changed to: ${state}`);

        // 8 = SET (Flywheel Locked)
        // 9 = GO (Flywheel Unlocked)
        // 10 = FALSE START
        if (state === 8) {
            this.rowing = false;
        } else if (state === 9) {
            this.rowing = true;
        } else if (state === 10) {
            this.rowing = false;
        } else {
            // Normal / Warmup
            this.rowing = true;
        }
    }
}

async function main() {
    console.log(`Finding session with code: ${JOIN_CODE}`);

    // 1. Get Session
    const { data: session, error } = await supabase
        .from('erg_sessions')
        .select('*')
        .eq('join_code', JOIN_CODE.toUpperCase())
        .eq('status', 'active')
        .single();

    if (error || !session) {
        console.error('Session not found or not active.');
        process.exit(1);
    }

    console.log(`Found Session: ${session.id} (Race State: ${session.race_state})`);

    // 2. Spawn Bots
    const bots: Bot[] = [];
    for (let i = 0; i < BOT_COUNT; i++) {
        const bot = new Bot(i, session.race_state || 0);
        if (await bot.join(session.id)) {
            bots.push(bot);
        }
    }

    console.log(`Spawned ${bots.length} bots. Rowing state: ${bots.length > 0 ? (bots[0].rowing ? 'ROWING' : 'IDLE') : 'N/A'}`);

    // 3. Listen for Race State
    supabase
        .channel(`sim_session_${session.id}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'erg_sessions', filter: `id=eq.${session.id}` },
            (payload) => {
                const newState = payload.new.race_state;
                if (newState !== undefined) {
                    bots.forEach(b => b.handleRaceState(newState));
                }
            }
        )
        .subscribe((status, err) => {
            console.log(`[Supabase] Subscription status: ${status}`, err ? err : '');
        });

    // 4. Loop
    setInterval(async () => {
        // Poll for race state explicitly (fallback for realtime issues)
        const { data: updatedSession } = await supabase
            .from('erg_sessions')
            .select('race_state')
            .eq('id', session.id)
            .single();

        if (updatedSession && updatedSession.race_state !== undefined) {
            bots.forEach(b => b.handleRaceState(updatedSession.race_state));
        }

        const updates = bots.map(async (bot) => {
            bot.updatePhysics(1.0); // 1 second step

            if (bot.id) {
                await supabase.from('erg_session_participants').update({
                    data: bot.getData(),
                    last_heartbeat: new Date().toISOString(),
                    status: 'active'
                }).eq('id', bot.id);
            }
        });

        // Don't await all, just fire and forget to keep loop running?
        // Better to await to avoid rate limit issues if possible, but 1s is slow enough.
        await Promise.all(updates);
        process.stdout.write('.');
    }, 1000);

    console.log('Simulation running. Press Ctrl+C to stop.');
}

main();
