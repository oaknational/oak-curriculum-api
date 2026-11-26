import { expect, test } from 'vitest';
import { makeCaller } from './helper';

test('get lesson from hasura', async () => {
  const caller = makeCaller({
    user: 1,
  });

  const res = await caller.getLessons.getLesson({
    lesson: 'joining-using-and',
  });

  expect(Array.isArray(res)).toBe(false); // we're expecting 1
  expect(res.keyStageSlug).toBe('ks1');
  expect(res.subjectSlug).toBe('english');
  expect(res.oakUrl).toBe(
    'https://www.thenational.academy/teachers/lessons/joining-using-and',
  );
});

test('lesson without programme variants returns a single-entry units array', async () => {
  const caller = makeCaller({
    user: 1,
  });

  const res = await caller.getLessons.getLesson({
    lesson: 'joining-using-and',
  });

  expect(res.units).toHaveLength(1);
  expect(typeof res.units[0].unitSlug).toBe('string');
  expect(typeof res.units[0].unitTitle).toBe('string');
  // Primary KS1 lesson has no programme factors.
  expect(res.units[0].programmeFactors).toBeUndefined();
});

test('structured-programs lesson exposes its KS4 unit and exam board', async () => {
  const caller = makeCaller({
    user: 1,
  });

  const res = await caller.getLessons.getLesson({
    lesson: 'structured-programs',
  });

  expect(res.keyStageSlug).toBe('ks4');
  expect(res.subjectSlug).toBe('computing');

  // The lesson sits in the programming-subroutines unit on the OCR exam board.
  // Each (unitSlug, programmeFactors) pair must be unique after deduplication.
  expect(res.units.length).toBeGreaterThanOrEqual(1);
  const matchingUnit = res.units.find(
    (u) =>
      u.unitSlug === 'programming-subroutines' &&
      u.programmeFactors?.examBoard?.slug === 'ocr' &&
      u.programmeFactors?.examBoard?.title === 'OCR',
  );
  expect(matchingUnit).toBeDefined();

  const seen = new Set<string>();
  for (const unit of res.units) {
    const key = [
      unit.unitSlug,
      unit.programmeFactors?.examBoard?.slug ?? '',
      unit.programmeFactors?.pathway?.slug ?? '',
      unit.programmeFactors?.tier?.slug ?? '',
    ].join('|');
    expect(seen.has(key)).toBe(false);
    seen.add(key);
  }
});

test('v1 lesson summary exposes the lesson equipment', async () => {
  const caller = makeCaller({ user: 1, major: 'v1' });

  const res = await caller.getLessons.getLessonV1({
    lesson: 'games-can-you-use-an-implement-to-keep-a-ball-up',
  });

  expect(typeof res.equipment).toBe('string');
  expect(res.equipment).toMatch(/ball/);
});

test('v1 lesson summary gives null equipment when none is listed', async () => {
  const caller = makeCaller({ user: 1, major: 'v1' });

  const res = await caller.getLessons.getLessonV1({
    lesson: 'joining-using-and',
  });

  expect(res.equipment).toBeNull();
});

test('v0 lesson summary leaves equipment out', async () => {
  const caller = makeCaller({ user: 1 });

  const res = await caller.getLessons.getLesson({
    lesson: 'games-can-you-use-an-implement-to-keep-a-ball-up',
  });

  expect(res).not.toHaveProperty('equipment');
});
