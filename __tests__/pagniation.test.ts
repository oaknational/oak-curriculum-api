import { describe, it, expect } from 'vitest';
import { nextPageLink } from '@/lib/pagination';
import { apiBaseUrl } from '@/lib/baseUrl';

describe('nextPageLink', () => {
  it('should generate next page link with offset and limit', () => {
    const result = nextPageLink('v0', '/api/users', 0, 10);
    expect(result).toContain('offset=10');
    expect(result).toContain('limit=10');
    expect(result).toContain('/api/users');
  });

  it('should increment offset by limit', () => {
    const result = nextPageLink('v0', '/api/users', 20, 10);
    expect(result).toContain('offset=30');
    expect(result).toContain('limit=10');
  });

  it('should handle larger offsets and limits', () => {
    const result = nextPageLink('v0', '/api/items', 100, 50);
    expect(result).toContain('offset=150');
    expect(result).toContain('limit=50');
  });

  it('should include unit parameter when provided', () => {
    const result = nextPageLink('v0', '/api/lessons', 0, 20, {
      unit: 'chapters',
    });
    expect(result).toContain('offset=20');
    expect(result).toContain('limit=20');
    expect(result).toContain('unit=chapters');
  });

  it('should not include unit parameter when not provided', () => {
    const result = nextPageLink('v0', '/api/lessons', 0, 20);
    expect(result).not.toContain('unit=');
  });

  it('should handle request URL with existing query parameters', () => {
    const result = nextPageLink('v0', '/api/users?sort=name', 0, 10);
    expect(result).toContain('offset=10');
    expect(result).toContain('limit=10');
    expect(result).toContain('/api/users');
  });

  it('should preserve pathname from request URL', () => {
    const result = nextPageLink('v0', '/api/v1/admin/users', 10, 5);
    expect(result).toContain('/api/v1/admin/users');
    expect(result).toContain('offset=15');
  });

  it('should handle zero offset at start', () => {
    const result = nextPageLink('v0', '/api/data', 0, 25);
    expect(result).toContain('offset=25');
    expect(result).toContain('limit=25');
  });

  it('should include baseUrl in returned link', () => {
    const result = nextPageLink('v0', '/api/users', 0, 10);
    expect(result).toBe(`${apiBaseUrl('v0')}/api/users?offset=10&limit=10`);
  });

  it('should handle unit parameter with special characters', () => {
    const result = nextPageLink('v0', '/api/lessons', 0, 10, {
      unit: 'lesson-units',
    });
    expect(result).toContain('unit=lesson-units');
  });

  it('should correctly encode URL parameters', () => {
    const result = nextPageLink('v0', '/api/search', 5, 15, {
      unit: 'test unit',
    });
    expect(result).toContain('offset=20');
    expect(result).toContain('limit=15');
    expect(result).toContain('unit');
  });
});
