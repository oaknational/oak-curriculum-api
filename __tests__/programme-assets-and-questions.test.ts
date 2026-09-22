import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadView,
  lessonRestrictionView,
  lessonView,
  unitVariantLessonsView,
} from '@/lib/owaClient';
import { API_MAJORS } from '@/lib/apiVersion';

const mocks = vi.hoisted(() => ({
  owaClientRequestMock: vi.fn(),
}));

vi.mock('@/lib/owaClient', async () => {
  const actual = await vi.importActual('@/lib/owaClient');
  return {
    ...actual,
    getClient: () => ({
      request: mocks.owaClientRequestMock,
    }),
  };
});

describe('programme assets and questions endpoints', () => {
  beforeEach(() => {
    mocks.owaClientRequestMock.mockReset();
  });

  it('/programmes/{programme}/assets returns [] when no lessons are found in programme', async () => {
    mocks.owaClientRequestMock.mockResolvedValue({
      [unitVariantLessonsView]: [],
    });

    const { authedCaller } = await import('./helper');
    const { caller } = authedCaller();

    await expect(
      caller.getAssets.getProgrammeAssets({
        programme: 'computing-secondary-year-7',
      }),
    ).resolves.toStrictEqual([]);

    expect(mocks.owaClientRequestMock).toHaveBeenCalledTimes(1);
    expect(mocks.owaClientRequestMock.mock.calls[0]?.[0]).toContain(
      `${unitVariantLessonsView}(`,
    );
    expect(mocks.owaClientRequestMock.mock.calls[0]?.[1]).toEqual({
      programme: 'computing-secondary-year-7',
    });
  });

  it('/programmes/{programme}/questions returns [] when no lessons are found in programme', async () => {
    mocks.owaClientRequestMock.mockResolvedValue({
      [unitVariantLessonsView]: [],
    });

    const { authedCaller } = await import('./helper');
    const { caller } = authedCaller();

    await expect(
      caller.getQuestions.getQuestionsForProgramme({
        programme: 'computing-secondary-year-7',
        offset: 0,
        limit: 10,
      }),
    ).resolves.toStrictEqual([]);

    expect(mocks.owaClientRequestMock).toHaveBeenCalledTimes(1);
    expect(mocks.owaClientRequestMock.mock.calls[0]?.[0]).toContain(
      `${unitVariantLessonsView}(`,
    );
    expect(mocks.owaClientRequestMock.mock.calls[0]?.[1]).toEqual({
      programme: 'computing-secondary-year-7',
    });
  });

  it('/programmes/{programme}/questions queries lessonView for programme lesson slugs', async () => {
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [unitVariantLessonsView]: [
        {
          lesson_slug: 'variables-and-data-types',
          unit_slug: 'variables',
          subject_slug: 'computing',
        },
      ],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [lessonRestrictionView]: [],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [lessonView]: [],
    });

    const { authedCaller } = await import('./helper');
    const { caller } = authedCaller();

    await expect(
      caller.getQuestions.getQuestionsForProgramme({
        programme: 'computing-secondary-year-7',
        offset: 0,
        limit: 10,
      }),
    ).resolves.toStrictEqual([]);

    expect(mocks.owaClientRequestMock).toHaveBeenCalledTimes(3);
    expect(mocks.owaClientRequestMock.mock.calls[1]?.[0]).toContain(
      `${lessonRestrictionView}(`,
    );
    expect(mocks.owaClientRequestMock.mock.calls[1]?.[1]).toEqual({
      slugs: ['variables-and-data-types'],
    });
    expect(mocks.owaClientRequestMock.mock.calls[2]?.[0]).toContain(
      `${lessonView}(`,
    );
    expect(mocks.owaClientRequestMock.mock.calls[2]?.[1]).toEqual({
      lessonSlugs: ['variables-and-data-types'],
      offset: 0,
      limit: 10,
    });
  });

  it('/programmes/{programme}/assets filters restricted lessons before fetching downloads', async () => {
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [unitVariantLessonsView]: [
        {
          lesson_slug: 'variables-and-data-types',
          unit_slug: 'variables',
          subject_slug: 'computing',
        },
        {
          lesson_slug: 'restricted-lesson',
          unit_slug: 'variables',
          subject_slug: 'computing',
        },
      ],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [lessonRestrictionView]: [
        {
          slug: 'restricted-lesson',
          tpc_downloadablefiles_max_restriction: 'Restricted',
        },
      ],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [downloadView]: [
        {
          lessonSlug: 'variables-and-data-types',
          lessonTitle: 'Variables and data types',
          slideDeck: {
            label: 'Slide Deck',
            bucket_path: 'LESS-ID/slidedeck/PDF.pdf',
          },
        },
      ],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [lessonView]: [
        {
          lessonSlug: 'variables-and-data-types',
          tpcWorks: [],
          tpcMedia: [],
        },
      ],
    });

    const { authedCaller } = await import('./helper');
    const { caller } = authedCaller();

    const result = await caller.getAssets.getProgrammeAssets({
      programme: 'computing-secondary-year-7',
      offset: 0,
      limit: 10,
    });

    expect(result).toMatchObject([
      {
        lessonSlug: 'variables-and-data-types',
        lessonTitle: 'Variables and data types',
        assets: [
          {
            label: 'Slide Deck',
            type: 'slideDeck',
          },
        ],
      },
    ]);
    expect(result.map((lesson) => lesson.lessonSlug)).not.toContain(
      'restricted-lesson',
    );
    expect(result[0]?.assets[0]?.url).toContain(
      '/api/v0/lessons/variables-and-data-types/assets/slideDeck',
    );

    expect(mocks.owaClientRequestMock).toHaveBeenCalledTimes(4);
    expect(mocks.owaClientRequestMock.mock.calls[2]?.[1]).toEqual({
      lessonSlugs: ['variables-and-data-types'],
    });
  });

  it.each(API_MAJORS)(
    'builds asset URLs for the major the request arrived on (%s)',
    async (major) => {
      // The end-to-end proof that the major reaches the payload: the same
      // handler and schemas produce a download URL under the caller's major.
      mocks.owaClientRequestMock.mockResolvedValueOnce({
        [unitVariantLessonsView]: [
          {
            lesson_slug: 'variables-and-data-types',
            unit_slug: 'variables',
            subject_slug: 'computing',
          },
        ],
      });
      mocks.owaClientRequestMock.mockResolvedValueOnce({
        [lessonRestrictionView]: [],
      });
      mocks.owaClientRequestMock.mockResolvedValueOnce({
        [downloadView]: [
          {
            lessonSlug: 'variables-and-data-types',
            lessonTitle: 'Variables and data types',
            slideDeck: {
              label: 'Slide Deck',
              bucket_path: 'LESS-ID/slidedeck/PDF.pdf',
            },
          },
        ],
      });
      mocks.owaClientRequestMock.mockResolvedValueOnce({
        [lessonView]: [
          {
            lessonSlug: 'variables-and-data-types',
            tpcWorks: [],
            tpcMedia: [],
          },
        ],
      });

      const { authedCaller } = await import('./helper');
      const { caller } = authedCaller(1, major);

      const result = await caller.getAssets.getProgrammeAssets({
        programme: 'computing-secondary-year-7',
      });

      expect(result[0]?.assets[0]?.url).toContain(
        `/api/${major}/lessons/variables-and-data-types/assets/slideDeck`,
      );

      for (const other of API_MAJORS.filter((m) => m !== major)) {
        expect(result[0]?.assets[0]?.url).not.toContain(`/api/${other}/`);
      }
    },
  );

  it('/key-stages/{keyStage}/subject/{subject}/assets filters restricted lessons before fetching downloads', async () => {
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [unitVariantLessonsView]: [
        {
          lesson_slug: 'noun-phrases',
          unit_slug: 'word-class',
        },
        {
          lesson_slug: 'restricted-lesson',
          unit_slug: 'word-class',
        },
      ],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [lessonRestrictionView]: [
        {
          slug: 'restricted-lesson',
          tpc_media_max_restriction: 'Highly restricted',
        },
      ],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [downloadView]: [
        {
          lessonSlug: 'noun-phrases',
          lessonTitle: 'Noun phrases',
          worksheet: {
            label: 'Worksheet',
            bucket_path: 'LESS-ID/worksheet/PDF.pdf',
          },
        },
      ],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [lessonView]: [
        {
          lessonSlug: 'noun-phrases',
          tpcWorks: [],
          tpcMedia: [],
        },
      ],
    });

    const { authedCaller } = await import('./helper');
    const { caller } = authedCaller();

    const result = await caller.getAssets.getSubjectAssets({
      keyStage: 'ks1',
      subject: 'english',
    });

    expect(result).toMatchObject([
      {
        lessonSlug: 'noun-phrases',
        lessonTitle: 'Noun phrases',
        assets: [
          {
            label: 'Worksheet',
            type: 'worksheet',
          },
        ],
      },
    ]);
    expect(result.map((lesson) => lesson.lessonSlug)).not.toContain(
      'restricted-lesson',
    );
    expect(result[0]?.assets[0]?.url).toContain(
      '/api/v0/lessons/noun-phrases/assets/worksheet',
    );

    expect(mocks.owaClientRequestMock).toHaveBeenCalledTimes(4);
    expect(mocks.owaClientRequestMock.mock.calls[2]?.[1]).toEqual({
      lessonSlugs: ['noun-phrases'],
    });
  });

  it('/key-stages/{keyStage}/subject/{subject}/assets applies offset/limit before restrictions and downloads', async () => {
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [unitVariantLessonsView]: [
        {
          lesson_slug: 'lesson-1',
          unit_slug: 'word-class',
        },
        {
          lesson_slug: 'lesson-2',
          unit_slug: 'word-class',
        },
        {
          lesson_slug: 'lesson-3',
          unit_slug: 'word-class',
        },
      ],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [lessonRestrictionView]: [],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [downloadView]: [
        {
          lessonSlug: 'lesson-2',
          lessonTitle: 'Lesson 2',
          worksheet: {
            label: 'Worksheet',
            bucket_path: 'LESS-ID/worksheet/PDF.pdf',
          },
        },
      ],
    });
    mocks.owaClientRequestMock.mockResolvedValueOnce({
      [lessonView]: [
        {
          lessonSlug: 'lesson-2',
          tpcWorks: [],
          tpcMedia: [],
        },
      ],
    });

    const { authedCaller } = await import('./helper');
    const { caller } = authedCaller();

    const result = await caller.getAssets.getSubjectAssets({
      keyStage: 'ks1',
      subject: 'english',
      offset: 1,
      limit: 1,
    });

    expect(result.map((lesson) => lesson.lessonSlug)).toStrictEqual([
      'lesson-2',
    ]);
    expect(mocks.owaClientRequestMock).toHaveBeenCalledTimes(4);
    expect(mocks.owaClientRequestMock.mock.calls[1]?.[1]).toEqual({
      slugs: ['lesson-2'],
    });
    expect(mocks.owaClientRequestMock.mock.calls[2]?.[1]).toEqual({
      lessonSlugs: ['lesson-2'],
    });
  });
});
