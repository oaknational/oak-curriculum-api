import { describe, expect, test } from 'vitest';
import { makeCaller } from './helper';

test('fetch transcripts from AI project', { timeout: 15 * 1000 }, async () => {
  const caller = makeCaller({
    user: 1,
  });

  const res = await caller.searchTranscripts.searchTranscripts({
    q: 'who were the romans?',
  });

  expect(Array.isArray(res)).toBe(true);
  const first = res[0];
  expect(typeof first.lessonTitle).toBe('string');
  expect(first.transcriptSnippet?.toLowerCase()).toContain('romans');
});

describe('GET /lessons/{lesson}/transcript', () => {
  // The content view carries legacy lessons, none of which has a transcript,
  // and plenty of current lessons have no video to transcribe. Both used to
  // reach `null.replace` and answer 500.
  test.each([
    ['a legacy lesson', 'sitting-on-the-bus-c4t64d'],
    ['a lesson with no transcript', 'south-african-gumboot-dance'],
  ])('%s is not found', async (_, lesson) => {
    const caller = makeCaller({ user: 1 });

    await expect(
      caller.getLessonTranscript.getLessonTranscript({ lesson }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('a lesson with a transcript still answers', async () => {
    const caller = makeCaller({ user: 1 });

    const res = await caller.getLessonTranscript.getLessonTranscript({
      lesson: '3d-shapes-can-be-composed-from-2d-nets',
    });

    expect(typeof res.transcript).toBe('string');
    expect(typeof res.vtt).toBe('string');
  });
});
