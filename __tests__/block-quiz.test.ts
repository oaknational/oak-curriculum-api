import { expect, test } from 'vitest';
import { extractCauseFromTRPCError, makeCaller } from './helper';
import { TRPCError } from '@trpc/server';

// this slug is on the hard-coded list in assetTypeRestrictionsByLesson.json,
// which the gate checks before the lesson's own restriction levels and which
// answers with the deliberately vague reason
test('restricted lesson throws on /lessons/{lesson}/quiz', async () => {
  const caller = makeCaller({ user: 1 });

  // note that this slug is in the hard-coded list in assetTypeRestrictionsByLesson.json
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
