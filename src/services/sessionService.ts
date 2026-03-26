import { supabase } from './supabase';
import type { Database } from '../types/supabase';
import type { PM5Data } from './bluetooth.types';
import { toActiveWorkoutSpec, type ErgLinkUploadMeta } from '../types/ergSession.types';

type Session = Database['public']['Tables']['erg_sessions']['Row'];
type Participant = Database['public']['Tables']['erg_session_participants']['Row'];
type Json = Database['public']['Tables']['workout_logs']['Row']['raw_data'];

const serializeStrokeData = (strokeData: PM5Data[]) => strokeData.map((stroke) => ({
    timestamp: stroke.timestamp,
    distance: stroke.distance,
    pace: stroke.pace,
    strokeRate: stroke.strokeRate,
    watts: stroke.watts,
    heartRate: stroke.heartRate,
    calories: stroke.calories,
    elapsedTime: stroke.elapsedTime,
}));

export const sessionService = {
    /**
     * Join a session by code
     */
    async joinSession(joinCode: string, displayName: string): Promise<{ session: Session; participant: Participant }> {
        if (!supabase) throw new Error('Supabase not configured');

        // 1. Find the session
        const { data: session, error: sessionError } = await supabase
            .from('erg_sessions')
            .select('*')
            .eq('join_code', joinCode.toUpperCase())
            .eq('status', 'active')
            .single();

        if (sessionError || !session) {
            throw new Error('Session not found or not active');
        }

        // 2. Create participant record
        const { data: participant, error: participantError } = await supabase
            .from('erg_session_participants')
            .insert({
                session_id: session.id,
                display_name: displayName,
                status: 'ready',
            })
            .select()
            .single();

        if (participantError || !participant) {
            throw new Error(`Failed to join session: ${participantError?.message}`);
        }

        return { session, participant };
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

        const updateData: Database['public']['Tables']['erg_session_participants']['Update'] = {
            status,
            last_heartbeat: new Date().toISOString(),
        };
        if (deviceId) updateData.device_id = deviceId;

        await supabase
            .from('erg_session_participants')
            .update(updateData)
            .eq('id', participantId);
    },

    /**
     * Stream live data (Throttled wrapper would be used in the App)
     */
    async updateParticipantData(participantId: string, data: PM5Data) {
        if (!supabase) return;

        const { error, count } = await supabase
            .from('erg_session_participants')
            .update({
                data: data as unknown as Database['public']['Tables']['erg_session_participants']['Update']['data'],
                status: 'active' as const,
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

        const channel = supabase.channel(`session-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'erg_sessions',
                    filter: `id=eq.${sessionId}`
                },
                (payload: { new: Session }) => {
                    if (payload.new) {
                        onSessionUpdate(payload.new);
                    }
                }
            )
            .subscribe((status: string) => {
                console.log(`[Session] Subscription status for ${sessionId}:`, status);
                if (status === 'SUBSCRIBED') {
                    console.log('[Session] Ready to receive workout updates.');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[Session] Subscription failed. Check connection or RLS policies.');
                }
            });

        // Polling Fallback (Robustness for Race State)
        const pollInterval = setInterval(async () => {
            if (!supabase) return;
            const { data } = await supabase
                .from('erg_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (data) {
                onSessionUpdate(data);
            }
        }, 2000);

        return {
            unsubscribe: () => {
                clearInterval(pollInterval);
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
        const { data } = await supabase
            .from('erg_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
        return data;
    },

    /**
     * Upload full workout log after session ends.
     * Authenticated users → workout_logs table.
     * Anonymous users → fallback to participant record.
     */
    async uploadWorkoutLog(sessionId: string, participantId: string, strokeData: PM5Data[]) {
        if (!supabase || strokeData.length === 0) return;

        const lastStroke = strokeData[strokeData.length - 1];
        const user = (await supabase.auth.getUser()).data.user;

        const { data: sessionForMetadata } = await supabase
            .from('erg_sessions')
            .select('active_workout')
            .eq('id', sessionId)
            .maybeSingle();

        const activeWorkout = toActiveWorkoutSpec(sessionForMetadata?.active_workout ?? null);

        if (user) {
            // Authenticated user → insert into workout_logs
            const rawMeta: ErgLinkUploadMeta = {
                strokes: serializeStrokeData(strokeData),
                source: 'erg_link_live',
                session_id: sessionId,
                participant_id: participantId,
                canonical_name: activeWorkout?.canonical_name ?? null,
                template_id: activeWorkout?.template_id ?? null,
                group_assignment_id: activeWorkout?.group_assignment_id ?? null,
            };

            const rawData = rawMeta as unknown as Json;

            const logEntry: Database['public']['Tables']['workout_logs']['Insert'] = {
                user_id: user.id,
                workout_name: activeWorkout?.title ?? activeWorkout?.canonical_name ?? 'Live Session Workout',
                workout_type: 'erg_session',
                completed_at: new Date().toISOString(),
                duration_seconds: lastStroke.elapsedTime || 0,
                distance_meters: Math.round(lastStroke.distance || 0),
                average_stroke_rate: lastStroke.strokeRate || null,
                watts: lastStroke.watts || null,
                source: 'erg_link_live',
                canonical_name: activeWorkout?.canonical_name ?? null,
                template_id: activeWorkout?.template_id ?? null,
                raw_data: rawData,
            };

            const { error: logError } = await supabase
                .from('workout_logs')
                .insert(logEntry);

            if (!logError) {
                console.log('[Session] Workout log saved successfully');
                return;
            }

            console.warn('[Session] Failed to insert workout_log, falling back to participant record:', logError);
        }

        // Fallback: anonymous user or insert failure → store in participant record
        console.log('[Session] Storing results in participant record for', participantId);
        await supabase
            .from('erg_session_participants')
            .update({
                status: 'disconnected' as const,
                data: {
                    strokes: strokeData,
                    summary: lastStroke,
                } as unknown as Database['public']['Tables']['erg_session_participants']['Update']['data'],
            })
            .eq('id', participantId);
    }
};
