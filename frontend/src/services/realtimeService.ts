/*
 * 前端实时数据服务。
 * 统一承接变量订阅、快照读取和回写命令；后端未完成时使用 Mock 适配器。
 */

export type RealtimeQuality = 'good' | 'bad' | 'uncertain';

export interface RealtimePoint {
    tag: string;
    value: unknown;
    unit?: string;
    quality: RealtimeQuality;
    ts: number;
}

export interface WriteTagOptions {
    action?: string;
    confirmId?: string;
}

export interface WriteTagResult {
    success: boolean;
    message: string;
    tag: string;
    value: unknown;
    ts: number;
}

type RealtimeListener = (point: RealtimePoint) => void;

const DEFAULT_MOCK_POINTS: Record<string, Omit<RealtimePoint, 'tag' | 'ts'>> = {
    temperature: { value: 45.2, unit: '℃', quality: 'good' },
    pressure: { value: 1.013, unit: 'MPa', quality: 'good' },
    flow_rate: { value: 120.5, unit: 'm³/h', quality: 'good' },
    level: { value: 78.3, unit: '%', quality: 'good' },
    humidity: { value: 62.1, unit: '%', quality: 'good' },
    voltage: { value: 380, unit: 'V', quality: 'good' },
    current: { value: 15.7, unit: 'A', quality: 'good' },
    rpm: { value: 1450, unit: 'r/min', quality: 'good' },
    pump_run: { value: 1, unit: '', quality: 'good' },
    valve_open: { value: 62, unit: '%', quality: 'good' },
    setpoint: { value: 75, unit: '℃', quality: 'good' },
};

class RealtimeService {
    private snapshots = new Map<string, RealtimePoint>();
    private listeners = new Map<string, Set<RealtimeListener>>();
    private mockTimerId: number | null = null;

    constructor()
    {
        const now = Date.now();
        Object.entries(DEFAULT_MOCK_POINTS).forEach(([tag, point]) => {
            this.snapshots.set(tag, {
                tag,
                ...point,
                ts: now,
            });
        });
    }

    subscribeTag(tag: string, listener: RealtimeListener)
    {
        const normalizedTag = tag.trim();

        if (!normalizedTag) {
            return () => undefined;
        }

        if (!this.listeners.has(normalizedTag)) {
            this.listeners.set(normalizedTag, new Set());
        }

        this.listeners.get(normalizedTag)!.add(listener);
        this.ensureMockTimer();

        const snapshot = this.snapshots.get(normalizedTag);
        if (snapshot) {
            window.setTimeout(() => listener(snapshot), 0);
        }

        return () => {
            const tagListeners = this.listeners.get(normalizedTag);
            tagListeners?.delete(listener);

            if (tagListeners && tagListeners.size === 0) {
                this.listeners.delete(normalizedTag);
            }
        };
    }

    subscribeTags(tags: string[], listener: RealtimeListener)
    {
        const unsubscribers = tags.map((tag) => this.subscribeTag(tag, listener));

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }

    async readTag(tag: string)
    {
        const normalizedTag = tag.trim();

        if (!this.snapshots.has(normalizedTag)) {
            this.upsertPoint({
                tag: normalizedTag,
                value: null,
                quality: 'uncertain',
                ts: Date.now(),
            });
        }

        return this.snapshots.get(normalizedTag)!;
    }

    async writeTag(
        tag: string,
        value: unknown,
        _options?: WriteTagOptions,
    ): Promise<WriteTagResult> {
        const normalizedTag = tag.trim();

        if (!normalizedTag) {
            return {
                success: false,
                message: '变量点位不能为空',
                tag: normalizedTag,
                value,
                ts: Date.now(),
            };
        }

        const previous = this.snapshots.get(normalizedTag);
        const point = {
            tag: normalizedTag,
            value,
            unit: previous?.unit,
            quality: 'good' as RealtimeQuality,
            ts: Date.now(),
        };

        this.upsertPoint(point);

        return {
            success: true,
            message: 'Mock 回写成功，后端接入后将等待 command_ack',
            tag: normalizedTag,
            value,
            ts: point.ts,
        };
    }

    getSnapshot(tag: string)
    {
        return this.snapshots.get(tag.trim()) || null;
    }

    private ensureMockTimer()
    {
        if (this.mockTimerId !== null) {
            return;
        }

        this.mockTimerId = window.setInterval(() => {
            Array.from(this.listeners.keys()).forEach((tag) => {
                const current = this.snapshots.get(tag);

                if (!current || typeof current.value !== 'number') {
                    return;
                }

                const delta = current.value * (Math.random() * 0.04 - 0.02);
                const value = Math.round((current.value + delta) * 100) / 100;

                this.upsertPoint({
                    ...current,
                    value,
                    ts: Date.now(),
                });
            });
        }, 1500);
    }

    private upsertPoint(point: RealtimePoint)
    {
        const previous = this.snapshots.get(point.tag);

        if (previous && previous.ts > point.ts) {
            return;
        }

        this.snapshots.set(point.tag, point);
        this.listeners.get(point.tag)?.forEach((listener) => listener(point));
    }
}

export const realtimeService = new RealtimeService();
