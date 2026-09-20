import type { WorkoutConfig } from '@readyall/erglink/pm5';
import type { ActiveWorkoutSpec } from '../types/ergSession.types';

export function activeWorkoutSpecToWorkoutConfig(workout: ActiveWorkoutSpec): WorkoutConfig {
    const fixedInterval = workout.type === 'interval_distance' || workout.type === 'interval_time';
    const intervals: NonNullable<WorkoutConfig['intervals']> = [];
    for (const interval of workout.intervals ?? []) {
        if (interval.type === 'rest') {
            const previous = intervals.at(-1);
            if (previous) previous.rest = interval.value;
            continue;
        }
        intervals.push({
            type: interval.type,
            value: interval.value,
            rest: interval.rest ?? 0,
        });
    }
    return {
        type: workout.type,
        value: workout.value ?? (fixedInterval ? workout.split_value : undefined),
        split: workout.split_value,
        rest: workout.rest,
        repeats: workout.repeats,
        intervals: workout.intervals ? intervals : undefined,
    };
}
