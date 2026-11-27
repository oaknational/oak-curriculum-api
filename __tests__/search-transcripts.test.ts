import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LessonRestrictionLevel,
  lessonRestrictionView,
  lessonView,
} from '@/lib/owaClient';

const mocks = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  findManyMock: vi.fn(),
  owaClientRequestMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mocks.queryRawMock,
    lesson: { findMany: mocks.findManyMock },
  },
}));

vi.mock('@/lib/owaClient', async () => {
  const actual = await vi.importActual('@/lib/owaClient');
  return {
    ...actual,
    getClient: () => ({ request: mocks.owaClientRequestMock }),
  };
});

/** Seven ranked candidates, best match first. */
const candidates = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  id: `id-${n}`,
  slug: `slug-${n}`,
  title: `Lesson ${n}`,
}));

describe('/search/transcripts', () => {
  beforeEach(() => {
    mocks.queryRawMock.mockReset();
    mocks.findManyMock.mockReset();
    mocks.owaClientRequestMock.mockReset();

    mocks.queryRawMock.mockResolvedValue(
      candidates.map((lesson) => ({
        lesson_id: lesson.id,
        source_content: `${lesson.title} mentions the romans`,
      })),
    );

    // deliberately not in rank order: the handler restores it
    mocks.findManyMock.mockResolvedValue([...candidates].reverse());

    mocks.owaClientRequestMock.mockImplementation((query: string) => {
      if (query.includes(lessonRestrictionView)) {
        return {
          [lessonRestrictionView]: candidates.map((lesson) => ({
            slug: lesson.slug,
            // slug-2 is restricted by the lesson's own media restriction
            tpc_media_max_restriction:
              lesson.slug === 'slug-2'
                ? LessonRestrictionLevel.HIGHLY_RESTRICTED
                : LessonRestrictionLevel.OGL_COMPATIBLE,
          })),
        };
      }

      const subjectSlugs: Record<string, string> = {
        // art restricts transcripts for the whole subject
        'slug-3': 'art',
      };

      return {
        [lessonView]: candidates.map((lesson) => ({
          lessonSlug: lesson.slug,
          subjectSlug: subjectSlugs[lesson.slug] ?? 'maths',
        })),
      };
    });
  });

  it('drops lessons restricted at the lesson and the subject level', async () => {
    const { makeCaller } = await import('./helper');
    const caller = makeCaller({ user: 1 });

    const result = await caller.searchTranscripts.searchTranscripts({
      q: 'the romans',
    });

    // slug-2 (media) and slug-3 (art transcripts) are gone, the five best of
    // what remains fill the results in rank order, and slug-5 survives because
    // geography restricts slide decks rather than transcripts
    expect(result.map((lesson) => lesson.lessonSlug)).toStrictEqual([
      'slug-1',
      'slug-4',
      'slug-5',
      'slug-6',
      'slug-7',
    ]);
  });

  it('returns the snippet that matched each lesson', async () => {
    const { makeCaller } = await import('./helper');
    const caller = makeCaller({ user: 1 });

    const result = await caller.searchTranscripts.searchTranscripts({
      q: 'the romans',
    });

    expect(result[0]).toStrictEqual({
      lessonTitle: 'Lesson 1',
      lessonSlug: 'slug-1',
      transcriptSnippet: 'Lesson 1 mentions the romans',
    });
  });

  it('gates every candidate, not just the five it would have returned', async () => {
    const { makeCaller } = await import('./helper');
    const caller = makeCaller({ user: 1 });

    await caller.searchTranscripts.searchTranscripts({ q: 'the romans' });

    const restrictionCall = mocks.owaClientRequestMock.mock.calls.find(
      ([query]) => String(query).includes(lessonRestrictionView),
    );
    const { slugs } = restrictionCall?.[1] as { slugs: string[] };

    expect([...slugs].sort()).toStrictEqual(
      candidates.map((lesson) => lesson.slug).sort(),
    );
  });
});
