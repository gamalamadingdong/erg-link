import { supabase } from './supabase';
import type { Database } from '../types/supabase';
import type { PM5Data } from './bluetooth.types';

type Session = Database['public']['Tables']['erg_sessions']['Row'];
type Participant = Database['public']['Tables']['erg_session_participants']['Row'];

export const sessionService = {
    /**
     * Join a session by code
     */
    async joinSession(joinCode: string, displayName: string): Promise<{ session: Session; participant: Participant }> {
        if (!supabase) throw new Error('Supabase not configured');

        // 1. Find the session
        const { data: sessions, error: sessionError } = await (supabase as any)
            .from('erg_sessions')
            .select('*')
            .eq('join_code', joinCode.toUpperCase())
            .eq('status', 'active')
            .single();

        if (sessionError || !sessions) {
            throw new Error('Session not found or not active');
        }

        const session = sessions as Session;

        // 2. Create participant record
        // Note: device_id is updated later when bluetooth connects
        // Cast supabase to any to bypass complex TS inference issues
        const { data: participant, error: participantError } = await (supabase as any)
            .from('erg_session_participants')
            .insert({
                session_id: session.id,
                display_name: displayName,
                status: 'ready',
            })
            .select()
            .single();

        if (participantError) {
            throw new Error(`Failed to join session: ${participantError.message}`);
        }

        return { session, participant: participant as Participant };
    },

    /**
     * Update participant status and device info
     */
    async updateParticipantStatus(
        participantId: string,
        status: 'ready' | 'active' | 'disconnected',
        deviceId?: string
    ) {
        if (!supabase) return;

        const updateData: any = { status, last_heartbeat: new Date().toISOString() };
        if (deviceId) updateData.device_id = deviceId;

        await (supabase as any)
            .from('erg_session_participants')
            .update(updateData)
            .eq('id', participantId);
    },

    /**
     * Stream live data (Throttled wrapper would be used in the App)
     */
    async updateParticipantData(participantId: string, data: PM5Data) {
        if (!supabase) return;

        // Cast PM5Data to Json compatible object (Supabase types expect Json)
        const jsonData = data as unknown as Record<string, unknown>;

        const { error, count } = await (supabase as any)
            .from('erg_session_participants')
            .update({
                data: jsonData,
                status: 'active',
                last_heartbeat: new Date().toISOString()
            }, { count: 'exact' })
            .eq('id', participantId);

        if (error) throw error;
        if (count === 0) throw new Error('Participant removed from session');
    },

    /**
     * Subscribe to session updates (e.g. active_workout, race_state)
     */
    subscribeToSession(sessionId: string, onSessionUpdate: (session: Session) => void) {
        if (!supabase) return { unsubscribe: () => { } };

        const client = supabase as any;
        const channel = client.channel(`session-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'erg_sessions',
                    filter: `id=eq.${sessionId}`
                },
                (payload: any) => {
                    // Send the whole new session object so the app can diff what it cares about
                    if (payload.new) {
                        onSessionUpdate(payload.new as Session);
                    }
                }
            )
            .subscribe((status: any) => {
                console.log(`[Session] Subscription status for ${sessionId}:`, status);
                if (status === 'SUBSCRIBED') {
                    console.log('[Session] Ready to receive workout updates.');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[Session] Subscription failed. Check connection or RLS policies.');
                }
            });

        return {
            unsubscribe: () => {
                if (supabase) {
                    supabase.removeChannel(channel);
                }
            }
        };
    },

    /**
     * Get current session data (useful for initial effective state)
     */
    async getCurrentSession(sessionId: string): Promise<Session | null> {
        if (!supabase) return null;
        const { data } = await (supabase as any)
            .from('erg_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
        return data as Session;
    }
};
