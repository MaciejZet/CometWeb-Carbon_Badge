import { vi } from 'vitest';

// Block real network calls globally. Tests override per-scenario with mockResolvedValueOnce.
vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('[test] Unmocked fetch — add mockFetch.mockResolvedValueOnce(...)')),
);
