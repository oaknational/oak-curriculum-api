import { vi, expect, test } from 'vitest';
import {
  getLessonAsset,
  makeCaller,
  mockWithUser,
  optionsLessonAsset,
} from './helper';
import { getVideoFromMux } from '@/lib/handlers/assets/helpers';
import placeholderVideos from '@/lib/queryGateData/placeholderVideoLessons.json' with { type: 'json' };

mockWithUser();

vi.mock('@google-cloud/storage', () => {
  class StorageMock {
    bucketName = '';

    fileName = '';

    getFiles = vi.fn().mockResolvedValue([
      [
        {
          name: 'LESS-ID/slidedeck/PDF.pdf',
          metadata: {
            contentType: 'application/pdf',
          },
        },
        {
          name: 'LESS-ID/slidedeck/PowerPoint.pptx',
          metadata: {
            contentType:
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          },
        },
      ],
    ]);

    bucket = vi.fn((name: string) => {
      this.bucketName = name;
      return this;
    });

    file = vi.fn((name: string) => {
      this.fileName = name;
      return this;
    });

    // a stand-in for a V4 signed URL: same shape as the real thing, with the
    // signing inputs echoed back so tests can assert on them
    getSignedUrl = vi.fn((options: { responseDisposition: string }) => {
      const url = new URL(
        `https://storage.googleapis.com/${this.bucketName}/${this.fileName}`,
      );
      url.searchParams.set('X-Goog-Signature', 'test-signature');
      url.searchParams.set(
        'response-content-disposition',
        options.responseDisposition,
      );
      return Promise.resolve([url.toString()]);
    });
  }

  return {
    Storage: StorageMock,
  };
});

test('get asset urls for maths lesson', async () => {
  const caller = makeCaller({
    user: 1,
  });

  const res = await caller.getAssets.getLessonAssets({
    lesson: 'checking-understanding-of-perimeter',
  });

  expect(res).toHaveProperty('oakUrl');
  expect(res.oakUrl).toBe(
    'https://www.thenational.academy/teachers/lessons/checking-understanding-of-perimeter',
  );
  expect(res).toHaveProperty('attribution');
  expect(res).toHaveProperty('assets');
  if (!('assets' in res) || res.assets === undefined) {
    throw new Error('assets not found in response');
  }
  expect(res.assets.length).toBeGreaterThan(0);
});

test('read a single asset (pdf)', async () => {
  const res = await getLessonAsset({
    lesson: 'checking-understanding-of-perimeter',
    type: 'slideDeck',
  });

  expect(res.status).toBe(302);
  expect(res.headers.get('access-control-allow-origin')).toBe('*');
  expect(res.headers.get('cache-control')).toBe('private, no-store');

  const location = new URL(res.headers.get('location') || '');

  expect(location.origin).toBe('https://storage.googleapis.com');
  expect(location.pathname).toContain('LESS-ID/slidedeck/PowerPoint.pptx');
  expect(location.searchParams.get('X-Goog-Signature')).toBeTruthy();
  expect(location.searchParams.get('response-content-disposition')).toBe(
    'attachment; filename="checking-understanding-of-perimeter_slidedeck.pptx"',
  );
});

test('lesson asset preflight returns CORS headers without auth', () => {
  const res = optionsLessonAsset();

  expect(res.status).toBe(204);
  expect(res.headers.get('access-control-allow-origin')).toBe('*');
  expect(res.headers.get('access-control-allow-methods')).toContain('OPTIONS');
  expect(res.headers.get('access-control-allow-headers')).toContain(
    'Authorization',
  );
});

// the asset routes redirect rather than serve the bytes, so the download
// filename now travels in the signed URL rather than on our own response
function dispositionOf(res: Response): string | null {
  const location = new URL(res.headers.get('location') || '');
  return location.searchParams.get('response-content-disposition');
}

test('request power point', async () => {
  const res1 = await getLessonAsset({
    lesson: 'checking-understanding-of-perimeter',
    type: 'slideDeck',
  });

  expect(dispositionOf(res1)).to.match(/\.pptx"$/);

  const res2 = await getLessonAsset({
    lesson: 'checking-understanding-of-perimeter',
    type: 'exitQuiz',
  });

  expect(dispositionOf(res2)).to.match(/\.pdf"$/);
});

test('sequence asset year filter', async () => {
  const caller = makeCaller({ user: 1 });
  const res = await caller.getAssets.getSequenceAssets({
    sequence: 'english-primary',
    year: 10,
  });

  expect(res.length).toBe(0);
});

test('blocked videos return 400', async () => {
  const lessonSlug = placeholderVideos[placeholderVideos.length - 1];

  const res = await getLessonAsset({
    lesson: lessonSlug,
    type: 'video',
  });

  expect(res.status).toBe(400);
});

test('specifically blocked lessons (assets only)', async () => {
  const lessons = [
    'constructing-scatter-graphs-by-utilising-technology',
    'constructing-bar-charts-by-utilising-technology',
    'constructing-pie-charts-by-utilising-technology',
  ];

  const caller = makeCaller({
    user: 1,
  });

  for (const lesson of lessons) {
    const res = await getLessonAsset({
      lesson,
      type: 'slideDeck',
    });

    expect(res.status, `${lesson} should be blocked`).toBe(400);

    const apiCall = () =>
      caller.getLessons.getLesson({
        lesson,
      });

    expect(apiCall).not.toThrow();
  }
});

test('lessons in the supported lessons array are allowed', async () => {
  // this will throw if the lesson is not allowed, which
  // is all we're testing for
  const res = await getLessonAsset({
    lesson: 'identifying-unknown-substances-including-barium',
    type: 'slideDeck',
  });

  expect(res).toBeInstanceOf(Response);
});

test('unknown lessons return not found when no downloadable assets exist', async () => {
  const res = await getLessonAsset({
    lesson: 'made up lesson for testing',
    type: 'video',
  });

  interface Body {
    message: string;
  }

  expect(res.status).toBe(404);
  const body = (await res.json()) as Body;
  expect(body).toHaveProperty('message');
  expect(body.message).toContain('No lessons found');
});

test('cycling down the quality of videos against mux', async () => {
  const streamUrl =
    'https://stream.video.thenational.academy/yD02mc00PWTu0201HlC9S8vC012R01m6Njvcvxbz2WzJzJISo.m3u8';

  const resultUrl = await getVideoFromMux(streamUrl, 'high');

  expect(resultUrl.endsWith('.mp4')).toBe(true);
  expect(resultUrl.endsWith('high.mp4')).toBe(false);
});

test('blocked lesson: growing-rearing-and-catching-our-food', async () => {
  const caller = makeCaller({
    user: 1,
  });

  const slug = 'growing-rearing-and-catching-our-food';

  const res404 = await getLessonAsset({
    lesson: slug,
    type: 'slideDeck',
  });
  expect(res404.status).toBe(400);

  // make sure it doesn't also turn up in the sequence assets
  const res = await caller.getAssets.getSequenceAssets({
    sequence: 'cooking-nutrition-secondary',
  });

  expect(res.map((a) => a.lessonSlug)).not.toContain(slug);
  expect(res.length).toBeGreaterThan(0);

  const ksres = await caller.getAssets.getSubjectAssets({
    subject: 'cooking-nutrition',
    keyStage: 'ks3',
  });

  expect(ksres.map((a) => a.lessonSlug)).not.toContain(slug);
});

test('unblocked lesson: making-yakisoba-noodles', async () => {
  const caller = makeCaller({
    user: 1,
  });

  const slug = 'making-yakisoba-noodles';

  // if this throws then the lesson is blocked
  await getLessonAsset({
    lesson: slug,
    type: 'slideDeck',
  });

  // make sure it doesn't also turn up in the sequence assets
  const res = await caller.getAssets.getSequenceAssets({
    sequence: 'cooking-nutrition-secondary',
  });

  expect(res.map((a) => a.lessonSlug)).toContain(slug);
  expect(res.length).toBeGreaterThan(0);

  const ksres = await caller.getAssets.getSubjectAssets({
    subject: 'cooking-nutrition',
    keyStage: 'ks3',
  });

  expect(ksres.map((a) => a.lessonSlug)).toContain(slug);
});

test('financial education is hidden: returns invalid enum value', async () => {
  const caller = makeCaller({
    user: 1,
  });

  const slug = 'financial-education';

  await expect(
    async () =>
      await caller.getAssets.getSubjectAssets({
        subject: slug,
        keyStage: 'ks2',
        type: 'slideDeck',
      }),
  ).rejects.toThrow('Invalid option');
});
