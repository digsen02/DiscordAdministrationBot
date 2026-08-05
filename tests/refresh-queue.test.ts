import { describe, expect, it, vi } from 'vitest';
import { RefreshQueue } from '../src/infrastructure/scheduler/refresh-queue.js';

describe('게시 갱신 큐', () => {
  it('같은 게시물 요청을 디바운스하고 합친다', async () => { vi.useFakeTimers(); const refresh = vi.fn(async () => undefined); const queue = new RefreshQueue(refresh, 100); queue.enqueue(1); queue.enqueue(1); queue.enqueue(2); expect(queue.size).toBe(2); await vi.advanceTimersByTimeAsync(100); expect(refresh).toHaveBeenCalledTimes(2); expect(refresh).toHaveBeenCalledWith(1); queue.cancelAll(); vi.useRealTimers(); });
});
