import { expect, test } from 'vitest';
import { extractCauseFromTRPCError, makeCaller } from './helper';
import { TRPCError } from '@trpc/server';

// this lesson is restricted per-lesson rather than by its subject or its own
// restriction levels, which the gate answers with the deliberately vague reason.
// it runs against live data, so it is the end-to-end check that the restriction
// view really does flag the lesson.
test('restricted lesson throws on /lessons/{lesson}/quiz', async () => {
  const caller = makeCaller({ user: 1 });

  // note that this lesson carries features.has_copyright_conflict in the
  // restriction view
  const slug = `the-importance-of-exchange-surfaces-and-transport-systems-in-humans`;

  try {
    await caller.getQuestions.getQuestionsForLessons({ lesson: slug });
    expect.fail('Expected to throw an error for quiz-blocked content');
  } catch (e) {
    const error = e as TRPCError;
    expect(error instanceof TRPCError).toBe(true);
    expect(error.code).toBe('BAD_REQUEST');
    expect(extractCauseFromTRPCError(error)).toContain(
      'not currently available',
    );
  }
});

test('non-blocked lesson returns quiz data on /lessons/{lesson}/quiz', async () => {
  const caller = makeCaller({ user: 1 });

  const res = await caller.getQuestions.getQuestionsForLessons({
    lesson: 'joining-using-and',
  });

  expect(Object.keys(res)).toEqual(['starterQuiz', 'exitQuiz']);
});
