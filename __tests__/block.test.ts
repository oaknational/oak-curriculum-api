import { expect, test, vi } from 'vitest';
import {
  LessonRestrictionLevel,
  lessonRestrictionView,
  lessonView,
} from '@/lib/owaClient';
import {
  getLessonsListingGate,
  getLessonsRestrictions,
  isLessonRestricted,
} from '@/lib/queryGate';
import type { GraphQLClient } from 'graphql-request';

/**
 * Responds per view: the gate queries the restriction levels and, when a
 * subject-level restriction could apply, the lesson's subject.
 */
function mockRequest(responses: Record<string, unknown>) {
  return vi.fn((query: string) => {
    const view = Object.keys(responses).find((name) => query.includes(name));
    return view ? { [view]: responses[view] } : {};
  });
}

function mockClient(responses: Record<string, unknown>): GraphQLClient {
  return { request: mockRequest(responses) } as unknown as GraphQLClient;
}

/** The request spy alongside its client, for the tests that count queries. */
function countedClient(responses: Record<string, unknown>) {
  const request = mockRequest(responses);

  return { client: { request } as unknown as GraphQLClient, request };
}

const oglCompatible = {
  tpc_downloadablefiles_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
  tpc_media_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
  tpc_quizimages_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
  tpc_works_max_restriction: LessonRestrictionLevel.OGL_COMPATIBLE,
};

/** the restriction view's per-lesson flag: restricts every asset type */
const copyrightConflict = { features: { has_copyright_conflict: true } };

function subjectResponses(lessonSlug: string, subjectSlug: string) {
  return {
    [lessonRestrictionView]: [{ ...oglCompatible, slug: lessonSlug }],
    [lessonView]: [{ lessonSlug, subjectSlug }],
  };
}

function subjectClient(lessonSlug: string, subjectSlug: string): GraphQLClient {
  return mockClient(subjectResponses(lessonSlug, subjectSlug));
}

test('isLessonRestricted blocks lessons with restricted content in any restriction field', async () => {
  const client = mockClient({
    [lessonRestrictionView]: [
      {
        ...oglCompatible,
        tpc_works_max_restriction: LessonRestrictionLevel.RESTRICTED,
      },
    ],
    [lessonView]: [{ lessonSlug: 'restricted-lesson', subjectSlug: 'maths' }],
  });

  const result = await isLessonRestricted(client, 'restricted-lesson', 'video');

  expect(result.isBlocked()).toBe(true);
  expect(result.reason).toContain('restricted content');
});

test('isLessonRestricted allows lessons with OGL compatible or equivalent restrictions', async () => {
  const client = mockClient({
    [lessonRestrictionView]: [
      {
        ...oglCompatible,
        tpc_downloadablefiles_max_restriction:
          LessonRestrictionLevel.OGL_EQUIVALENT,
      },
    ],
    [lessonView]: [
      { lessonSlug: 'ogl-equivalent-lesson', subjectSlug: 'maths' },
    ],
  });

  const result = await isLessonRestricted(
    client,
    'ogl-equivalent-lesson',
    'video',
  );

  expect(result.isAllowed()).toBe(true);
});

test('getLessonsRestrictions returns true only for restricted lessons', async () => {
  const client = mockClient({
    [lessonRestrictionView]: [
      {
        slug: 'restricted-lesson',
        tpc_downloadablefiles_max_restriction:
          LessonRestrictionLevel.HIGHLY_RESTRICTED,
      },
      {
        slug: 'allowed-lesson',
        tpc_downloadablefiles_max_restriction:
          LessonRestrictionLevel.OGL_COMPATIBLE,
      },
    ],
  });

  await expect(
    getLessonsRestrictions(client, ['restricted-lesson', 'allowed-lesson']),
  ).resolves.toStrictEqual({
    'restricted-lesson': true,
    'allowed-lesson': false,
  });
});

test('isLessonRestricted blocks the asset types a subject restricts', async () => {
  const result = await isLessonRestricted(
    subjectClient('art-lesson', 'art'),
    'art-lesson',
    'video',
  );

  // the lesson's own levels are all OGL compatible, so the subject is the only
  // thing that can block it. The reason is deliberately vague and says nothing
  // about which of the two it was.
  expect(result.isBlocked()).toBe(true);
  expect(result.reason).toContain('not currently available');
});

test('isLessonRestricted allows the asset types a subject does not restrict', async () => {
  const result = await isLessonRestricted(
    subjectClient('english-lesson', 'english'),
    'english-lesson',
    'worksheet',
  );

  expect(result.isAllowed()).toBe(true);
});

test('isLessonRestricted restricts asset types per subject, not across subjects', async () => {
  const english = subjectClient('english-lesson', 'english');

  await expect(
    isLessonRestricted(english, 'english-lesson', 'video').then((gate) =>
      gate.isBlocked(),
    ),
  ).resolves.toBe(true);

  await expect(
    isLessonRestricted(english, 'english-lesson', 'worksheet').then((gate) =>
      gate.isBlocked(),
    ),
  ).resolves.toBe(false);

  await expect(
    isLessonRestricted(
      subjectClient('maths-lesson', 'maths'),
      'maths-lesson',
      'slideDeck',
    ).then((gate) => gate.isBlocked()),
  ).resolves.toBe(false);
});

test('isLessonRestricted blocks every asset type of a wholly restricted subject', async () => {
  for (const assetType of [
    'video',
    'transcript',
    'quiz',
    'worksheet',
  ] as const) {
    const result = await isLessonRestricted(
      subjectClient('re-lesson', 'religious-education'),
      're-lesson',
      assetType,
    );

    expect(result.isBlocked()).toBe(true);
    expect(result.reason).toContain('not currently available');
  }
});

test('isLessonRestricted queries the subject for every asset type', async () => {
  const { client, request } = countedClient(
    subjectResponses('art-lesson', 'art'),
  );

  const result = await isLessonRestricted(client, 'art-lesson', 'quiz');

  expect(result.isBlocked()).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
});

test('getLessonsRestrictions applies the subject-level restrictions too', async () => {
  const client = mockClient({
    [lessonRestrictionView]: [
      { ...oglCompatible, slug: 'art-lesson' },
      { ...oglCompatible, slug: 'maths-lesson' },
    ],
    [lessonView]: [
      { lessonSlug: 'art-lesson', subjectSlug: 'art' },
      { lessonSlug: 'maths-lesson', subjectSlug: 'maths' },
    ],
  });

  await expect(
    getLessonsRestrictions(client, ['art-lesson', 'maths-lesson'], 'video'),
  ).resolves.toStrictEqual({
    'art-lesson': true,
    'maths-lesson': false,
  });
});

// Omitting the asset type means "any restriction at all applies", so a
// partially restricted subject counts as restricted. The asset listings are
// the exception — see `getLessonsListingGate`.
test('getLessonsRestrictions restricts on any asset type when given none', async () => {
  const client = mockClient({
    [lessonRestrictionView]: [
      { ...oglCompatible, slug: 'art-lesson' },
      { ...oglCompatible, slug: 'english-lesson' },
      { ...oglCompatible, slug: 'maths-lesson' },
    ],
    [lessonView]: [
      { lessonSlug: 'art-lesson', subjectSlug: 'art' },
      { lessonSlug: 'english-lesson', subjectSlug: 'english' },
      { lessonSlug: 'maths-lesson', subjectSlug: 'maths' },
    ],
  });

  await expect(
    getLessonsRestrictions(client, [
      'art-lesson',
      'english-lesson',
      'maths-lesson',
    ]),
  ).resolves.toStrictEqual({
    'art-lesson': true,
    'english-lesson': true,
    'maths-lesson': false,
  });
});

test('getLessonsRestrictions queries subjects for every asset type', async () => {
  const { client, request } = countedClient(
    subjectResponses('art-lesson', 'art'),
  );

  await expect(
    getLessonsRestrictions(client, ['art-lesson'], 'quiz'),
  ).resolves.toStrictEqual({ 'art-lesson': true });

  expect(request).toHaveBeenCalledTimes(2);
});

// These two cover the per-lesson restriction, which the restriction view
// carries as a copyright-conflict flag rather than this repo as a list.
test('isLessonRestricted blocks a lesson flagged as a copyright conflict whatever its subject', async () => {
  const slug = 'conflict-lesson';
  const { client, request } = countedClient({
    [lessonRestrictionView]: [{ ...oglCompatible, ...copyrightConflict, slug }],
    [lessonView]: [{ lessonSlug: slug, subjectSlug: 'maths' }],
  });

  const result = await isLessonRestricted(client, slug, 'worksheet');

  expect(result.isBlocked()).toBe(true);
  // the subject is looked up first, because it decides whether the lesson is
  // there at all; the flag rides on the restriction row, so the levels query is
  // needed to see it
  expect(request).toHaveBeenCalledTimes(2);
});

test('getLessonsRestrictions blocks lessons flagged as a copyright conflict', async () => {
  const slug = 'conflict-lesson';
  const client = mockClient({
    [lessonRestrictionView]: [
      { ...oglCompatible, ...copyrightConflict, slug },
      { ...oglCompatible, slug: 'maths-lesson' },
    ],
    [lessonView]: [{ lessonSlug: 'maths-lesson', subjectSlug: 'maths' }],
  });

  await expect(
    getLessonsRestrictions(client, [slug, 'maths-lesson'], 'worksheet'),
  ).resolves.toStrictEqual({
    [slug]: true,
    'maths-lesson': false,
  });
});

// a listing asks whether anything is left to list, so a lesson of a partially
// restricted subject survives it and reports the types to withhold instead
test('isLessonRestricted allows a listing of a partially restricted lesson', async () => {
  const result = await isLessonRestricted(
    subjectClient('english-lesson', 'english'),
    'english-lesson',
    undefined,
    { listing: true },
  );

  expect(result.isAllowed()).toBe(true);
  expect(result.withheldAssetTypes).toStrictEqual(['video', 'transcript']);
});

// the withheld types still have to travel with a lesson the gate allows, even
// when the lesson has no restriction row of its own to collapse
test('isLessonRestricted reports the withheld types of a lesson with no restriction row', async () => {
  const result = await isLessonRestricted(
    mockClient({
      [lessonRestrictionView]: [],
      [lessonView]: [{ lessonSlug: 'english-lesson', subjectSlug: 'english' }],
    }),
    'english-lesson',
    undefined,
    { listing: true },
  );

  expect(result.isAllowed()).toBe(true);
  expect(result.reason).toBe('Lesson not in restrictions');
  expect(result.withheldAssetTypes).toStrictEqual(['video', 'transcript']);
});

test('isLessonRestricted blocks a listing of a wholly restricted lesson', async () => {
  const result = await isLessonRestricted(
    subjectClient('art-lesson', 'art'),
    'art-lesson',
    undefined,
    { listing: true },
  );

  expect(result.isBlocked()).toBe(true);
});

test('getLessonsListingGate keeps partially restricted lessons and drops the rest', async () => {
  const client = mockClient({
    [lessonRestrictionView]: [
      { ...oglCompatible, slug: 'art-lesson' },
      { ...oglCompatible, slug: 'english-lesson' },
      { ...oglCompatible, slug: 'maths-lesson' },
      {
        ...oglCompatible,
        slug: 'restricted-maths-lesson',
        tpc_works_max_restriction: LessonRestrictionLevel.RESTRICTED,
      },
    ],
    [lessonView]: [
      { lessonSlug: 'art-lesson', subjectSlug: 'art' },
      { lessonSlug: 'english-lesson', subjectSlug: 'english' },
      { lessonSlug: 'maths-lesson', subjectSlug: 'maths' },
      { lessonSlug: 'restricted-maths-lesson', subjectSlug: 'maths' },
    ],
  });

  const { lessonsAllowed, withheldAssetTypes } = await getLessonsListingGate(
    client,
    ['art-lesson', 'english-lesson', 'maths-lesson', 'restricted-maths-lesson'],
  );

  expect(lessonsAllowed).toStrictEqual(['english-lesson', 'maths-lesson']);
  expect(withheldAssetTypes.get('english-lesson')).toStrictEqual([
    'video',
    'transcript',
  ]);
  expect(withheldAssetTypes.get('maths-lesson')).toBeUndefined();
});

test('getLessonsListingGate drops a lesson restricted for the asset type asked for', async () => {
  const client = mockClient({
    [lessonRestrictionView]: [{ ...oglCompatible, slug: 'english-lesson' }],
    [lessonView]: [{ lessonSlug: 'english-lesson', subjectSlug: 'english' }],
  });

  await expect(
    getLessonsListingGate(client, ['english-lesson'], 'video').then(
      (gate) => gate.lessonsAllowed,
    ),
  ).resolves.toStrictEqual([]);

  await expect(
    getLessonsListingGate(client, ['english-lesson'], 'worksheet').then(
      (gate) => gate.lessonsAllowed,
    ),
  ).resolves.toStrictEqual(['english-lesson']);
});
