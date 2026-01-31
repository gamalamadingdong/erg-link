export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            erg_sessions: {
                Row: {
                    id: string
                    join_code: string
                    status: 'active' | 'finished'
                    created_by: string | null
                    created_at: string | null
                    ended_at: string | null
                    active_workout: Json | null
                }
                Insert: {
                    id?: string
                    join_code: string
                    status: 'active' | 'finished'
                    created_by?: string | null
                    created_at?: string | null
                    ended_at?: string | null
                    active_workout?: Json | null
                }
                Update: {
                    id?: string
                    join_code?: string
                    status?: 'active' | 'finished'
                    created_by?: string | null
                    created_at?: string | null
                    ended_at?: string | null
                    active_workout?: Json | null
                }
            }
            erg_session_participants: {
                Row: {
                    id: string
                    session_id: string
                    display_name: string
                    device_id: string | null
                    status: 'ready' | 'active' | 'disconnected'
                    data: Json | null
                    last_heartbeat: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    session_id: string
                    display_name: string
                    device_id?: string | null
                    status: 'ready' | 'active' | 'disconnected'
                    data?: Json | null
                    last_heartbeat?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    session_id?: string
                    display_name?: string
                    device_id?: string | null
                    status?: 'ready' | 'active' | 'disconnected'
                    data?: Json | null
                    last_heartbeat?: string | null
                    created_at?: string | null
                }
            }
        }
    }
}
