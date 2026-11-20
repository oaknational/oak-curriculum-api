import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import type { ApiMajor } from '@/lib/apiVersion';
import {
  LessonRestrictionLevel,
  lessonRestrictionView,
  lessonView,
  unitVariantLessonsView,
} from '@/lib/owaClient';
import { allGatedAssetTypes } from '@/lib/queryGateData/assetTypeRestrictions';
import { openApiDocumentFor } from '@/lib/zod-openapi/schema/generateDocument';

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

vi.mock('@/lib/apikeys', () => ({
  findUserByKey: vi.fn().mockResolvedValue({
    id: 99,
    key: 'test-key',
    rateLimit: 0,
  }),
}));

vi.mock('@/lib/rateLimit', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rateLimiter: () => ({
      check: vi.fn(() => ({ isSubjectToRateLimiting: false })),
    }),
  };
});

const trpcRoute = {
  v0: () => import('@/app/api/v0/[...trpc]/route'),
  v1: () => import('@/app/api/v1/[...trpc]/route'),
} as const;

const oglCompatible = {
  tpc_downloadablefiles_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
  tpc_media_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
  tpc_quizimages_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
  tpc_works_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
};

/** Every asset type at one status, with some overridden. */
function everyType(
  status: 'ogl-compatible' | 'restricted',
  overrides: Record<string, 'ogl-compatible' | 'restricted'> = {},
) {
  return {
    ...Object.fromEntries(allGatedAssetTypes.map((type) => [type, status])),
    ...overrides,
  };
}

/**
 * One fixture covering each way the gate can answer: the subject layer in part
 * (english) and in whole (art), the lesson's own levels, a copyright conflict,
 * a lesson with no row in the restriction view, and a subject this API does not
 * serve.
 */
const subjectsByLesson: Record<string, string> = {
  'english-lesson': 'english',
  'english-lesson-without-row': 'english',
  'art-lesson': 'art',
  'maths-lesson': 'maths',
  'maths-lesson-restricted-levels': 'maths',
  'maths-lesson-conflict': 'maths',
  'maths-lesson-without-row': 'maths',
  'financial-lesson': 'financial-education',
};

const restrictionRows = [
  { ...oglCompatible, slug: 'english-lesson' },
  { ...oglCompatible, slug: 'art-lesson' },
  { ...oglCompatible, slug: 'maths-lesson' },
  {
    ...oglCompatible,
    slug: 'maths-lesson-restricted-levels',
    tpc_media_max_restriction: LessonRestrictionLevel.RESTRICTED,
  },
  {
    ...oglCompatible,
    slug: 'maths-lesson-conflict',
    features: { has_copyright_conflict: true },
  },
  { ...oglCompatible, slug: 'financial-lesson' },
];

const allSlugs = Object.keys(subjectsByLesson);

function respondWithFixture(unitLessons: string[] = allSlugs) {
  mocks.owaClientRequestMock.mockImplementation(
    (query: string, variables: { slugs?: string[] } = {}) => {
      if (query.includes(unitVariantLessonsView)) {
        return {
          [unitVariantLessonsView]: unitLessons.map((lesson_slug) => ({
            lesson_slug,
          })),
        };
      }

      const asked = new Set(variables.slugs ?? allSlugs);

      if (query.includes(lessonRestrictionView)) {
        return {
          [lessonRestrictionView]: restrictionRows.filter((row) =>
            asked.has(row.slug),
          ),
        };
      }

      return {
        [lessonView]: Object.entries(subjectsByLesson)
          .filter(([lessonSlug]) => asked.has(lessonSlug))
          .map(([lessonSlug, subjectSlug]) => ({ lessonSlug, subjectSlug })),
      };
    },
  );
}

const expectedDetailed = {
  'english-lesson': everyType('ogl-compatible', {
    video: 'restricted',
    transcript: 'restricted',
  }),
  // the layer stands on its own, so no row in the view is no reason to leave
  // the lesson out
  'english-lesson-without-row': everyType('ogl-compatible', {
    video: 'restricted',
    transcript: 'restricted',
  }),
  'art-lesson': everyType('restricted'),
  'maths-lesson': everyType('ogl-compatible'),
  // a lesson's own levels and a copyright conflict restrict every asset type
  'maths-lesson-restricted-levels': everyType('restricted'),
  'maths-lesson-conflict': everyType('restricted'),
};

const expectedCollapsed = {
  'english-lesson': 'restricted',
  'english-lesson-without-row': 'restricted',
  'art-lesson': 'restricted',
  'maths-lesson': 'ogl-compatible',
  'maths-lesson-restricted-levels': 'restricted',
  'maths-lesson-conflict': 'restricted',
};

/** `Response.json()` is typed `any`; this pins it to what the test expects. */
async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function postCheckRestricted(
  major: ApiMajor,
  query: string,
  lessonSlugs: string[] = allSlugs,
): Promise<Response> {
  const { POST } = await trpcRoute[major]();

  return POST(
    new Request(
      `http://localhost:2727/api/${major}/lessons/check-restricted${query}`,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ lessonSlugs }),
      },
    ) as NextRequest,
  );
}

async function getKeyStageCheckRestricted(
  major: ApiMajor,
  query: string,
): Promise<Response> {
  const { GET } = await trpcRoute[major]();

  return GET(
    new Request(
      `http://localhost:2727/api/${major}/key-stages/ks3/subject/english/check-restricted${query}`,
      { method: 'GET', headers: { authorization: 'Bearer test-key' } },
    ) as NextRequest,
  );
}

describe('check-restricted ?detailed', () => {
  beforeEach(() => {
    mocks.owaClientRequestMock.mockReset();
    respondWithFixture();
  });

  describe('POST /lessons/check-restricted at v1', () => {
    it.each(['true', '1'])(
      'returns every asset type for each lesson with detailed=%s',
      async (value) => {
        const res = await postCheckRestricted('v1', `?detailed=${value}`);

        expect(res.status).toBe(200);
        await expect(readJson(res)).resolves.toStrictEqual(expectedDetailed);
      },
    );

    it.each(['', '?detailed=false', '?detailed=0'])(
      'returns one status per lesson with %j',
      async (query) => {
        const res = await postCheckRestricted('v1', query);

        expect(res.status).toBe(200);
        await expect(readJson(res)).resolves.toStrictEqual(expectedCollapsed);
      },
    );

    it('rejects a detailed value it does not recognise', async () => {
      const res = await postCheckRestricted('v1', '?detailed=yes');

      expect(res.status).toBe(400);
    });

    it('collapses to the status the detailed answer implies', async () => {
      const detailed = await readJson<Record<string, Record<string, string>>>(
        await postCheckRestricted('v1', '?detailed=true'),
      );
      const collapsed = await readJson<Record<string, string>>(
        await postCheckRestricted('v1', ''),
      );

      // the same lessons, each restricted exactly when one of its asset types is
      expect(Object.keys(detailed).sort()).toStrictEqual(
        Object.keys(collapsed).sort(),
      );
      for (const [slug, byType] of Object.entries(detailed)) {
        expect(collapsed[slug]).toBe(
          Object.values(byType).includes('restricted')
            ? 'restricted'
            : 'ogl-compatible',
        );
      }
    });
  });

  describe('GET /key-stages/{keyStage}/subject/{subject}/check-restricted at v1', () => {
    it('returns every asset type for each lesson with detailed=true', async () => {
      respondWithFixture(['english-lesson', 'english-lesson-without-row']);

      const res = await getKeyStageCheckRestricted('v1', '?detailed=true');

      expect(res.status).toBe(200);
      await expect(readJson(res)).resolves.toStrictEqual({
        'english-lesson': expectedDetailed['english-lesson'],
        'english-lesson-without-row':
          expectedDetailed['english-lesson-without-row'],
      });
    });

    it('returns one status per lesson without detailed', async () => {
      respondWithFixture(['english-lesson']);

      const res = await getKeyStageCheckRestricted('v1', '');

      expect(res.status).toBe(200);
      await expect(readJson(res)).resolves.toStrictEqual({
        'english-lesson': 'restricted',
      });
    });

    it('rejects a detailed value it does not recognise', async () => {
      const res = await getKeyStageCheckRestricted('v1', '?detailed=yes');

      expect(res.status).toBe(400);
    });

    it('returns an empty object for a page with no lessons', async () => {
      respondWithFixture([]);

      const res = await getKeyStageCheckRestricted('v1', '?detailed=true');

      expect(res.status).toBe(200);
      await expect(readJson(res)).resolves.toStrictEqual({});
    });
  });

  // v0 is frozen: it takes no new features, so it ignores the parameter
  describe('at v0', () => {
    it('POST /lessons/check-restricted ignores detailed', async () => {
      const res = await postCheckRestricted('v0', '?detailed=true');

      expect(res.status).toBe(200);
      await expect(readJson(res)).resolves.toStrictEqual(expectedCollapsed);
    });

    it('GET /key-stages/{keyStage}/subject/{subject}/check-restricted ignores detailed', async () => {
      respondWithFixture(['english-lesson']);

      const res = await getKeyStageCheckRestricted('v0', '?detailed=true');

      expect(res.status).toBe(200);
      await expect(readJson(res)).resolves.toStrictEqual({
        'english-lesson': 'restricted',
      });
    });
  });
});

describe('check-restricted ?detailed in the OpenAPI document', () => {
  function parameters(major: ApiMajor, path: string, method: 'get' | 'post') {
    const operation = openApiDocumentFor(major).paths?.[path]?.[method] as
      | { parameters?: { name: string; in: string; description?: string }[] }
      | undefined;

    return operation?.parameters ?? [];
  }

  it.each([
    ['/lessons/check-restricted', 'post'],
    ['/key-stages/{keyStage}/subject/{subject}/check-restricted', 'get'],
  ] as const)('%s documents detailed at v1', (path, method) => {
    expect(parameters('v1', path, method)).toContainEqual(
      expect.objectContaining({
        name: 'detailed',
        in: 'query',
        description: expect.stringContaining('every asset type') as unknown,
      }),
    );
  });

  it.each([
    ['/lessons/check-restricted', 'post'],
    ['/key-stages/{keyStage}/subject/{subject}/check-restricted', 'get'],
  ] as const)('%s does not document detailed at v0', (path, method) => {
    expect(
      parameters('v0', path, method).map(({ name }) => name),
    ).not.toContain('detailed');
  });
});
