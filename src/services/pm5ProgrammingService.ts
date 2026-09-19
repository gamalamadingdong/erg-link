import { activeWorkoutSpecToWorkoutConfig, type WorkoutConfig } from '../lib/pm5-protocol/commands';
import type {
    ActiveWorkoutSpec,
    PM5ProgrammingReceiptV1,
    PM5ProgrammingStatus,
} from '../types/ergSession.types';

export interface PM5ProgrammingServiceDependencies {
    program: (workout: WorkoutConfig) => Promise<void>;
    writeReceipt: (receipt: PM5ProgrammingReceiptV1) => Promise<void>;
    now?: () => string;
}

export interface PM5ProgrammingDeliveryOptions {
    force?: boolean;
}

function classifyError(error: unknown): { status: PM5ProgrammingStatus; message: string } {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    if (normalized.includes('rejected')) return { status: 'rejected', message };
    if (normalized.includes('not ready')) return { status: 'not_ready', message };
    if (normalized.includes('unsupported') || normalized.includes('limited to 20 bytes')) {
        return { status: 'unsupported', message };
    }
    return { status: 'transport_error', message };
}

export class PM5ProgrammingService {
    private queue: Promise<void> = Promise.resolve();
    private readonly receipts = new Map<string, PM5ProgrammingReceiptV1>();
    private readonly program: (workout: WorkoutConfig) => Promise<void>;
    private readonly writeReceipt: (receipt: PM5ProgrammingReceiptV1) => Promise<void>;
    private readonly now: () => string;

    constructor(dependencies: PM5ProgrammingServiceDependencies) {
        this.program = dependencies.program;
        this.writeReceipt = dependencies.writeReceipt;
        this.now = dependencies.now ?? (() => new Date().toISOString());
    }

    deliver(
        request: ActiveWorkoutSpec,
        options: PM5ProgrammingDeliveryOptions = {},
    ): Promise<PM5ProgrammingReceiptV1> {
        const operation = async () => this.deliverSerialized(request, options);
        const result = this.queue.then(operation, operation);
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }

    private async deliverSerialized(
        request: ActiveWorkoutSpec,
        options: PM5ProgrammingDeliveryOptions,
    ): Promise<PM5ProgrammingReceiptV1> {
        const requestId = request.programming_request_id;
        if (!requestId) {
            return {
                _v: 1,
                request_id: 'legacy-unidentified',
                status: 'unsupported',
                received_at: this.now(),
                completed_at: this.now(),
                error: 'Programming request is missing programming_request_id',
            };
        }

        const existing = this.receipts.get(requestId);
        if (!options.force && existing?.status === 'programmed') return existing;

        const received: PM5ProgrammingReceiptV1 = {
            _v: 1,
            request_id: requestId,
            status: 'received',
            received_at: this.now(),
        };
        this.receipts.set(requestId, received);
        await this.writeReceipt(received);

        let completed: PM5ProgrammingReceiptV1;
        try {
            await this.program(activeWorkoutSpecToWorkoutConfig(request));
            completed = {
                ...received,
                status: 'programmed',
                completed_at: this.now(),
            };
        } catch (error) {
            const classified = classifyError(error);
            completed = {
                ...received,
                status: classified.status,
                completed_at: this.now(),
                error: classified.message,
            };
        }

        this.receipts.set(requestId, completed);
        await this.writeReceipt(completed);
        return completed;
    }
}
