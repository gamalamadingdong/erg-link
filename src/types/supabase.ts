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
                    race_state: number
                }
                Insert: {
                    id?: string
                    join_code: string
                    status: 'active' | 'finished'
                    created_by?: string | null
                    created_at?: string | null
                    ended_at?: string | null
                    active_workout?: Json | null
                    race_state?: number
                }
                Update: {
                    id?: string
                    join_code?: string
                    status?: 'active' | 'finished'
                    created_by?: string | null
                    created_at?: string | null
                    ended_at?: string | null
                    active_workout?: Json | null
                    race_state?: number
                }
                Relationships: []
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
                    group_name: string | null
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
                    group_name?: string | null
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
                    group_name?: string | null
                }
                Relationships: []
            }
            workout_logs: {
                Row: {
                    id: string
                    user_id: string
                    template_id: string | null
                    workout_name: string
                    workout_type: string
                    completed_at: string
                    duration_minutes: number | null
                    distance_meters: number | null
                    calories_burned: number | null
                    average_heart_rate: number | null
                    max_heart_rate: number | null
                    average_stroke_rate: number | null
                    notes: string | null
                    rating: number | null
                    created_at: string | null
                    updated_at: string | null
                    training_zone: string | null
                    avg_split_500m: number | null
                    perceived_exertion: number | null
                    external_id: string | null
                    source: string
                    raw_data: Json | null
                    watts: number | null
                    duration_seconds: number | null
                    zone_distribution: Json | null
                    canonical_name: string | null
                    manual_rwn: string | null
                    rest_distance_meters: number | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    template_id?: string | null
                    workout_name: string
                    workout_type: string
                    completed_at: string
                    duration_minutes?: number | null
                    distance_meters?: number | null
                    calories_burned?: number | null
                    average_heart_rate?: number | null
                    max_heart_rate?: number | null
                    average_stroke_rate?: number | null
                    notes?: string | null
                    rating?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                    training_zone?: string | null
                    avg_split_500m?: number | null
                    perceived_exertion?: number | null
                    external_id?: string | null
                    source?: string
                    raw_data?: Json | null
                    watts?: number | null
                    duration_seconds?: number | null
                    zone_distribution?: Json | null
                    canonical_name?: string | null
                    manual_rwn?: string | null
                    rest_distance_meters?: number | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    template_id?: string | null
                    workout_name?: string
                    workout_type?: string
                    completed_at?: string
                    duration_minutes?: number | null
                    distance_meters?: number | null
                    calories_burned?: number | null
                    average_heart_rate?: number | null
                    max_heart_rate?: number | null
                    average_stroke_rate?: number | null
                    notes?: string | null
                    rating?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                    training_zone?: string | null
                    avg_split_500m?: number | null
                    perceived_exertion?: number | null
                    external_id?: string | null
                    source?: string
                    raw_data?: Json | null
                    watts?: number | null
                    duration_seconds?: number | null
                    zone_distribution?: Json | null
                    canonical_name?: string | null
                    manual_rwn?: string | null
                    rest_distance_meters?: number | null
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
