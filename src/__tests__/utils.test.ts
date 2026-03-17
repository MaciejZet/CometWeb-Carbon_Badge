/**
 * Tests for pure utility functions extracted from badge.ts
 * These are copied here to test in isolation (they're not exported from badge.ts).
 */
import { describe, it, expect } from 'vitest';
import { co2ToScore } from '../estimator';

// --- Inline the private helpers so we can test them without exporting ---

function toFiniteNumber(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- toFiniteNumber ---

describe('toFiniteNumber', () => {
    it('returns the number unchanged when finite', () => {
        expect(toFiniteNumber(1.5, 0)).toBe(1.5);
        expect(toFiniteNumber(0, 99)).toBe(0);
        expect(toFiniteNumber(-5, 0)).toBe(-5);
    });

    it('parses a numeric string', () => {
        expect(toFiniteNumber('3.14', 0)).toBe(3.14);
    });

    it('returns fallback for NaN', () => {
        expect(toFiniteNumber(NaN, 42)).toBe(42);
        expect(toFiniteNumber('abc', 42)).toBe(42);
    });

    it('returns fallback for Infinity', () => {
        expect(toFiniteNumber(Infinity, 0)).toBe(0);
        expect(toFiniteNumber(-Infinity, 0)).toBe(0);
    });

    it('returns fallback for non-numeric objects', () => {
        // Number(null) === 0 (finite) — returns 0, not fallback
        expect(toFiniteNumber(null, 7)).toBe(0);
        // Number(undefined) === NaN — returns fallback
        expect(toFiniteNumber(undefined, 7)).toBe(7);
        // Number({}) === NaN — returns fallback
        expect(toFiniteNumber({}, 7)).toBe(7);
    });
});

// --- clamp ---

describe('clamp', () => {
    it('returns value when within range', () => {
        expect(clamp(50, 0, 100)).toBe(50);
        expect(clamp(0, 0, 100)).toBe(0);
        expect(clamp(100, 0, 100)).toBe(100);
    });

    it('clamps to min', () => {
        expect(clamp(-1, 0, 100)).toBe(0);
    });

    it('clamps to max', () => {
        expect(clamp(101, 0, 100)).toBe(100);
    });
});

// --- escapeHtml ---

describe('escapeHtml', () => {
    it('escapes all five dangerous characters', () => {
        expect(escapeHtml('&')).toBe('&amp;');
        expect(escapeHtml('<')).toBe('&lt;');
        expect(escapeHtml('>')).toBe('&gt;');
        expect(escapeHtml('"')).toBe('&quot;');
        expect(escapeHtml("'")).toBe('&#39;');
    });

    it('escapes a complete XSS payload', () => {
        const input = '<script>alert("xss")</script>';
        const output = escapeHtml(input);
        expect(output).not.toContain('<script>');
        expect(output).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('leaves safe strings unchanged', () => {
        expect(escapeHtml('Hello, world!')).toBe('Hello, world!');
        expect(escapeHtml('0.23g CO₂e')).toBe('0.23g CO₂e');
    });

    it('handles empty string', () => {
        expect(escapeHtml('')).toBe('');
    });
});

// --- co2ToScore ---

describe('co2ToScore', () => {
    it('returns A+ for values below 0.10g', () => {
        expect(co2ToScore(0)).toBe('A+');
        expect(co2ToScore(0.09)).toBe('A+');
        expect(co2ToScore(0.0999)).toBe('A+');
    });

    it('returns A at the 0.10 boundary', () => {
        expect(co2ToScore(0.10)).toBe('A');
        expect(co2ToScore(0.19)).toBe('A');
    });

    it('returns B between 0.20 and 0.39', () => {
        expect(co2ToScore(0.20)).toBe('B');
        expect(co2ToScore(0.39)).toBe('B');
    });

    it('returns C between 0.40 and 0.69', () => {
        expect(co2ToScore(0.40)).toBe('C');
        expect(co2ToScore(0.69)).toBe('C');
    });

    it('returns D between 0.70 and 0.99', () => {
        expect(co2ToScore(0.70)).toBe('D');
        expect(co2ToScore(0.99)).toBe('D');
    });

    it('returns F at 1.00 and above', () => {
        expect(co2ToScore(1.00)).toBe('F');
        expect(co2ToScore(5.0)).toBe('F');
    });
});
