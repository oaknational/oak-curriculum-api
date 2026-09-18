import { describe, expect, it } from 'vitest';

import {
  createCompanyHash,
  normaliseCompanyName,
} from '@/lib/analytics/posthogServer';

const apiKey = 'company-hash-test-api-key';

describe('normaliseCompanyName', () => {
  it('folds case and whitespace so typo variants collapse together', () => {
    expect(normaliseCompanyName('Vision')).toBe('vision');
    expect(normaliseCompanyName('vision')).toBe('vision');
    expect(normaliseCompanyName('  Vis ion ')).toBe('vision');
  });

  it('rejects empty and placeholder companies', () => {
    for (const company of ['', '   ', 'N/A', 'n/a', 'None', '-', null]) {
      expect(normaliseCompanyName(company)).toBeUndefined();
    }
  });

  it('keeps short real company names', () => {
    expect(normaliseCompanyName('OAT')).toBe('oat');
    expect(normaliseCompanyName('MEI')).toBe('mei');
  });
});

describe('createCompanyHash', () => {
  it('gives every user at one company the same hash', () => {
    const one = createCompanyHash({ company: 'Oak National Academy', apiKey });
    const two = createCompanyHash({
      company: 'oaknational academy',
      apiKey: 'a-different-key',
    });

    expect(one).toBeDefined();
    expect(one?.source).toBe('company');
    expect(one?.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(two).toEqual(one);
  });

  it('does not leak the company name into the hash', () => {
    const result = createCompanyHash({ company: 'Microsoft', apiKey });

    expect(result).toBeDefined();
    if (!result) {
      throw new Error('Expected company hash for a valid company name');
    }

    const { hash } = result;

    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(hash).not.toContain('microsoft');
  });

  it('gives different companies different hashes', () => {
    expect(createCompanyHash({ company: 'Faculty AI' })?.hash).not.toBe(
      createCompanyHash({ company: 'Canva' })?.hash,
    );
  });

  it('falls back to the API key when the company is unusable', () => {
    const fromKey = createCompanyHash({ company: 'N/A', apiKey });

    expect(fromKey).toBeDefined();
    expect(fromKey?.source).toBe('api_key');
    expect(fromKey?.hash).toMatch(/^[0-9a-f]{16}$/);
    // Two "N/A" users must not look like one organisation.
    expect(fromKey?.hash).not.toBe(
      createCompanyHash({ company: 'n/a', apiKey: 'another-key' })?.hash,
    );
    // ...but the same user is stable across their requests.
    expect(createCompanyHash({ company: null, apiKey })).toEqual(fromKey);
  });

  it('is undefined when there is neither a company nor a key', () => {
    expect(createCompanyHash({})).toBeUndefined();
    expect(createCompanyHash({ company: 'N/A', apiKey: null })).toBeUndefined();
  });
});
