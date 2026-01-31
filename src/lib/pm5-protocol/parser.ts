/**
 * PM5 Protocol Data Parsers
 * 
 * Parses raw BLE characteristic data from PM5 performance monitors.
 * Based on Concept2 PM CSAFE Communication Definition V0.27
 */

import {
    PM5_CHARACTERISTICS,
    getUint16LE,
    getUint24LE,
    type GeneralStatusData,
    type AdditionalStatus1Data,
    type AdditionalStatus2Data,
    type PM5AggregatedData,
    WorkoutType,
    IntervalType,
    WorkoutState,
    RowingState,
    StrokeState,
    ErgMachineType,
} from './types';

// ============================================================================
// CHARACTERISTIC PARSERS
// ============================================================================

/**
 * Parse General Status characteristic (0x0031, 19 bytes)
 * 
 * Data layout:
 * - Bytes 0-2: Elapsed Time (0.01 sec LSB)
 * - Bytes 3-5: Distance (0.1 m LSB)
 * - Byte 6: Workout Type
 * - Byte 7: Interval Type
 * - Byte 8: Workout State
 * - Byte 9: Rowing State
 * - Byte 10: Stroke State
 * - Bytes 11-13: Total Work Distance
 */
export function parseRowingGeneralStatus(data: DataView): GeneralStatusData {
    return {
        elapsedTime: getUint24LE(data, 0),           // 0.01 sec units
        distance: getUint24LE(data, 3),              // 0.1 m units
        workoutType: data.getUint8(6),
        intervalType: data.getUint8(7),
        workoutState: data.getUint8(8),
        rowingState: data.getUint8(9),
        strokeState: data.getUint8(10),
        totalWorkDistance: getUint24LE(data, 11),    // meters
    };
}

/**
 * Parse Additional Status 1 characteristic (0x0032, 17 bytes)
 * 
 * Data layout:
 * - Bytes 0-2: Elapsed Time (0.01 sec LSB)
 * - Bytes 3-4: Speed (0.001 m/s LSB)
 * - Byte 5: Stroke Rate (strokes/min)
 * - Byte 6: Heart Rate (bpm, 255=invalid)
 * - Bytes 7-8: Current Pace (0.01 sec per 500m)
 * - Bytes 9-10: Average Pace (0.01 sec per 500m)
 * - Bytes 11-12: Rest Distance (meters)
 * - Bytes 13-15: Rest Time (0.01 sec LSB)
 * - Byte 16: Erg Machine Type
 */
export function parseRowingAdditionalStatus1(data: DataView): AdditionalStatus1Data {
    return {
        elapsedTime: getUint24LE(data, 0),
        speed: getUint16LE(data, 3),                 // 0.001 m/s units
        strokeRate: data.getUint8(5),
        heartRate: data.getUint8(6),
        currentPace: getUint16LE(data, 7),           // 0.01 sec units
        averagePace: getUint16LE(data, 9),           // 0.01 sec units
        restDistance: getUint16LE(data, 11),
        restTime: getUint24LE(data, 13),             // 0.01 sec units
        ergMachineType: data.getUint8(16),
    };
}

/**
 * Parse Additional Status 2 characteristic (0x0033, 20 bytes)
 * 
 * Data layout:
 * - Bytes 0-2: Elapsed Time (0.01 sec LSB)
 * - Byte 3: Interval Count
 * - Bytes 4-5: Average Power (watts)
 * - Bytes 6-7: Total Calories
 * - Bytes 8-9: Split/Interval Avg Pace (0.01 sec per 500m)
 * - Bytes 10-11: Split/Interval Avg Power (watts)
 * - Bytes 12-13: Split/Interval Avg Calories (cals/hr)
 * - Bytes 14-16: Last Split Time (0.1 sec LSB)
 * - Bytes 17-19: Last Split Distance (meters)
 */
export function parseRowingAdditionalStatus2(data: DataView): AdditionalStatus2Data {
    return {
        elapsedTime: getUint24LE(data, 0),
        intervalCount: data.getUint8(3),
        averagePower: getUint16LE(data, 4),
        totalCalories: getUint16LE(data, 6),
        splitAvgPace: getUint16LE(data, 8),          // 0.01 sec units
        splitAvgPower: getUint16LE(data, 10),
        splitAvgCalories: getUint16LE(data, 12),     // cals/hr
        lastSplitTime: getUint24LE(data, 14),        // 0.1 sec units
        lastSplitDistance: getUint24LE(data, 17),
    };
}

// ============================================================================
// DATA AGGREGATOR
// ============================================================================

/**
 * Aggregates data from multiple PM5 characteristics into a unified view.
 * Updates incrementally as new characteristic data arrives.
 */
export class PM5DataAggregator {
    private data: PM5AggregatedData;

    constructor() {
        this.data = this.createDefaultData();
    }

    private createDefaultData(): PM5AggregatedData {
        return {
            timestamp: Date.now(),
            elapsedTime: 0,
            distance: 0,
            workoutType: WorkoutType.JUST_ROW_NO_SPLITS,
            intervalType: IntervalType.TIME,
            workoutState: WorkoutState.WAITING,
            rowingState: RowingState.INACTIVE,
            strokeState: StrokeState.WAITING,
            pace: 0,
            averagePace: 0,
            strokeRate: 0,
            watts: 0,
            averageWatts: 0,
            heartRate: 0,
            calories: 0,
            intervalCount: 0,
            splitAvgPace: 0,
            splitAvgPower: 0,
            ergMachineType: ErgMachineType.STATIC_D,
        };
    }

    /**
     * Update aggregated data from a characteristic notification
     */
    update(characteristicUUID: string, dataView: DataView): void {
        this.data.timestamp = Date.now();

        const uuid = characteristicUUID.toLowerCase();

        if (uuid === PM5_CHARACTERISTICS.ROWING_GENERAL_STATUS) {
            const parsed = parseRowingGeneralStatus(dataView);
            this.data.elapsedTime = parsed.elapsedTime / 100;    // Convert to seconds
            this.data.distance = parsed.distance / 10;           // Convert to meters
            this.data.workoutType = parsed.workoutType;
            this.data.intervalType = parsed.intervalType;
            this.data.workoutState = parsed.workoutState;
            this.data.rowingState = parsed.rowingState;
            this.data.strokeState = parsed.strokeState;
        }
        else if (uuid === PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS1) {
            const parsed = parseRowingAdditionalStatus1(dataView);
            this.data.strokeRate = parsed.strokeRate;
            this.data.heartRate = parsed.heartRate === 255 ? 0 : parsed.heartRate;
            this.data.pace = parsed.currentPace / 100;           // Convert to seconds
            this.data.averagePace = parsed.averagePace / 100;    // Convert to seconds
            this.data.ergMachineType = parsed.ergMachineType;

            // Estimate watts from pace if available
            if (parsed.currentPace > 0) {
                // Pace is in 0.01 sec per 500m, convert to watts using C2 formula
                const paceSeconds = parsed.currentPace / 100;
                this.data.watts = Math.round(2.8 / Math.pow(paceSeconds / 500, 3));
            }
        }
        else if (uuid === PM5_CHARACTERISTICS.ROWING_ADDITIONAL_STATUS2) {
            const parsed = parseRowingAdditionalStatus2(dataView);
            this.data.intervalCount = parsed.intervalCount;
            this.data.averageWatts = parsed.averagePower;
            this.data.calories = parsed.totalCalories;
            this.data.splitAvgPace = parsed.splitAvgPace / 100;  // Convert to seconds
            this.data.splitAvgPower = parsed.splitAvgPower;
        }
    }

    /**
     * Get the current aggregated data
     */
    getData(): PM5AggregatedData {
        return { ...this.data };
    }

    /**
     * Reset all data to defaults
     */
    reset(): void {
        this.data = this.createDefaultData();
    }
}
