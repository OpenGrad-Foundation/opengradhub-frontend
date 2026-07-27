import { describe, it, expect, vi } from 'vitest';
import { addSchoolLinksBatch } from '@/lib/attendance-bulk';

describe('addSchoolLinksBatch', () => {
  it('calls the adder once per unique id, de-duping repeats', async () => {
    const add = vi.fn().mockResolvedValue({});
    const result = await addSchoolLinksBatch(['a', 'b', 'a'], add);
    expect(add).toHaveBeenCalledTimes(2);
    expect(result.linked).toBe(2);
    expect(result.failed).toEqual([]);
  });

  it('does nothing for an empty selection', async () => {
    const add = vi.fn();
    const result = await addSchoolLinksBatch([], add);
    expect(add).not.toHaveBeenCalled();
    expect(result).toEqual({ linked: 0, failed: [] });
  });

  it('reports failures per id while keeping the successes', async () => {
    const add = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('School is outside your scope.');
      return {};
    });
    const result = await addSchoolLinksBatch(['a', 'b', 'c'], add);
    expect(result.linked).toBe(2);
    expect(result.failed).toEqual([{ id: 'b', message: 'School is outside your scope.' }]);
  });

  it('throws when every call fails, so callers surface one clear error', async () => {
    const add = vi.fn().mockRejectedValue(new Error('Forbidden'));
    await expect(addSchoolLinksBatch(['a', 'b'], add)).rejects.toThrow('Forbidden');
  });

  it('still attempts the work when handed a nonsensical concurrency', async () => {
    const add = vi.fn().mockResolvedValue({});
    const result = await addSchoolLinksBatch(['a', 'b'], add, 0);
    expect(add).toHaveBeenCalledTimes(2);
    expect(result.linked).toBe(2);
  });

  it('never runs more than the concurrency limit at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const add = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
    });

    const ids = Array.from({ length: 12 }, (_, i) => `s${i}`);
    const result = await addSchoolLinksBatch(ids, add, 5);

    expect(add).toHaveBeenCalledTimes(12);
    expect(result.linked).toBe(12);
    expect(peak).toBeLessThanOrEqual(5);
  });
});
