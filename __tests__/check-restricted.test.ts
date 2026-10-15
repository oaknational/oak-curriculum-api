import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LessonRestrictionLevel,
  lessonRestrictionView,
  lessonView,
  unitVariantLessonsView,
} from '@/lib/owaClient';
import manualRestrictedLessonSlugs from '@/lib/queryGateData/assetTypeRestrictionsByLesson.json' with { type: 'json' };

const mocks = vi.hoisted(() => ({
  owaClientRequestMock: vi.fn(),
}));

vi.mock('@/lib/owaClient', async () => {
  const actual = await vi.importActual('@/lib/owaClient');
  return {
    ...actual,
    getClient: () => ({ request: mocks.owaClientRequestMock }),
  };
});

const oglCompatible = {
  tpc_downloadablefiles_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
  tpc_media_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
  tpc_quizimages_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
  tpc_works_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
};

/**
 * Both check-restricted endpoints read the gate, so they answer for the whole
 * of it: the lesson's own restriction levels, the restricted subjects, and the
 * hard-coded list.
 */
function respondWith(
  restrictionRows: Record<string, unknown>[],
  subjectsByLesson: Record<string, string>,
) {
  mocks.owaClientRequestMock.mockImplementation((query: string) => {
    if (query.includes(lessonRestrictionView)) {
      return { [lessonRestrictionView]: restrictionRows };
    }

    return {
      [lessonView]: Object.entries(subjectsByLesson).map(
        ([lessonSlug, subjectSlug]) => ({ lessonSlug, subjectSlug }),
      ),
    };
  });
}

describe('check-restricted endpoints', () => {
  beforeEach(() => {
    mocks.owaClientRequestMock.mockReset();
  });

  describe('POST /lessons/check-restricted', () => {
    it('restricts a lesson whose subject is restricted', async () => {
      respondWith(
        [
          { ...oglCompatible, slug: 'art-lesson' },
          { ...oglCompatible, slug: 'maths-lesson' },
        ],
        { 'art-lesson': 'art', 'maths-lesson': 'maths' },
      );

      const { authedCaller } = await import('./helper');
      const { caller } = authedCaller();

      await expect(
        caller.getLessons.postCheckRestrictedLessons({
          lessonSlugs: ['art-lesson', 'maths-lesson'],
        }),
      ).resolves.toStrictEqual({
        'art-lesson': 'restricted',
        'maths-lesson': 'ogl-compatible',
      });
    });

    it("restricts a lesson on its own restriction levels when the subject isn't restricted", async () => {
      respondWith(
        [
          {
            ...oglCompatible,
            slug: 'maths-lesson',
            tpc_works_max_restriction: LessonRestrictionLevel.HIGHLY_RESTRICTED,
          },
        ],
        { 'maths-lesson': 'maths' },
      );

      const { authedCaller } = await import('./helper');
      const { caller } = authedCaller();

      await expect(
        caller.getLessons.postCheckRestrictedLessons({
          lessonSlugs: ['maths-lesson'],
        }),
      ).resolves.toStrictEqual({ 'maths-lesson': 'restricted' });
    });

    it('restricts a lesson on the hard-coded list with no restriction row of its own', async () => {
      const [slug] = manualRestrictedLessonSlugs;

      respondWith([], {});

      const { authedCaller } = await import('./helper');
      const { caller } = authedCaller();

      await expect(
        caller.getLessons.postCheckRestrictedLessons({ lessonSlugs: [slug] }),
      ).resolves.toStrictEqual({ [slug]: 'restricted' });
    });
  });

  describe('GET /key-stages/{keyStage}/subject/{subject}/check-restricted', () => {
    it('restricts the lessons of a restricted subject', async () => {
      mocks.owaClientRequestMock.mockImplementation((query: string) => {
        if (query.includes(unitVariantLessonsView)) {
          return {
            [unitVariantLessonsView]: [
              { lesson_slug: 'art-lesson' },
              { lesson_slug: 'other-art-lesson' },
            ],
          };
        }

        if (query.includes(lessonRestrictionView)) {
          return {
            [lessonRestrictionView]: [
              { ...oglCompatible, slug: 'art-lesson' },
              { ...oglCompatible, slug: 'other-art-lesson' },
            ],
          };
        }

        return {
          [lessonView]: [
            { lessonSlug: 'art-lesson', subjectSlug: 'art' },
            { lessonSlug: 'other-art-lesson', subjectSlug: 'art' },
          ],
        };
      });

      const { authedCaller } = await import('./helper');
      const { caller } = authedCaller();

      await expect(
        caller.getKeyStageSubjectLessons.getKeyStageSubjectLessonRestrictions({
          keyStage: 'ks3',
          subject: 'art',
          offset: 0,
          limit: 10,
        }),
      ).resolves.toStrictEqual({
        'art-lesson': 'restricted',
        'other-art-lesson': 'restricted',
      });
    });

    it('leaves the lessons of an unrestricted subject alone', async () => {
      mocks.owaClientRequestMock.mockImplementation((query: string) => {
        if (query.includes(unitVariantLessonsView)) {
          return {
            [unitVariantLessonsView]: [{ lesson_slug: 'maths-lesson' }],
          };
        }

        if (query.includes(lessonRestrictionView)) {
          return {
            [lessonRestrictionView]: [
              { ...oglCompatible, slug: 'maths-lesson' },
            ],
          };
        }

        return {
          [lessonView]: [{ lessonSlug: 'maths-lesson', subjectSlug: 'maths' }],
        };
      });

      const { authedCaller } = await import('./helper');
      const { caller } = authedCaller();

      await expect(
        caller.getKeyStageSubjectLessons.getKeyStageSubjectLessonRestrictions({
          keyStage: 'ks3',
          subject: 'maths',
          offset: 0,
          limit: 10,
        }),
      ).resolves.toStrictEqual({ 'maths-lesson': 'ogl-compatible' });
    });
  });
});
