import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import * as z from 'zod/v4';
import { subjectSlugs } from '@/lib/keyStageAndSubjects';
import {
  getSubjectFromProgrammes,
  getSubjectPhase,
  phaseToKeyStages,
  yearsFromKeyStages,
} from './helpers';
import { errorResponses } from '@/lib/errorResponses';
import {
  allSubjectsResponseSchema,
  subjectKeyStagesRequestSchema,
  subjectKeyStagesResponseSchema,
  subjectRequestSchema,
  subjectResponseSchema,
  subjectYearsRequestSchema,
  subjectYearsResponseSchema,
} from './schemas';

export const getSubjects = router({
  getAllSubjects: v0Procedure
    .meta({
      openapi: {
        tags: ['lists'],
        method: 'GET',
        path: '/subjects',
        summary: 'All subjects',
        description: `Use when you need every subject in one call — the entry point for a subject picker or for crawling the whole curriculum. Returns subjects alphabetically, each with subjectTitle, subjectSlug, sequenceSlugs, keyStages, and years. sequenceSlugs lists the sequences available for that subject; each sequence contains one programme per year group — call GET /subjects/{subject}/programmes to enumerate them.

Not for: a single subject (GET /subjects/{subject}); the key stages or year groups for a subject (GET /subjects/{subject}/key-stages or GET /subjects/{subject}/years); lessons or units inside a subject (GET /key-stages/{keyStage}/subject/{subject}/lessons or GET /key-stages/{keyStage}/subject/{subject}/units); the detail of one sequence (GET /sequences/{sequence}).`,
        errorResponses,
      },
    })
    .input(z.void())
    .output(allSubjectsResponseSchema)
    .query(() => {
      return subjectSlugs;
    }),
  getSubject: v0Procedure
    .meta({
      openapi: {
        tags: ['lists'],
        method: 'GET',
        summary: 'Single subject with sequences, key stages, and years',
        path: '/subjects/{subject}',
        errorResponses,
        description: `Use when you have a subject slug. Returns subjectTitle, subjectSlug, sequenceSlugs, keyStages, and years. sequenceSlugs lists the sequences available for this subject; each sequence contains one programme per year group — call GET /subjects/{subject}/programmes to enumerate them.

Not for: every subject in one call (GET /subjects); the key stages or year groups for a subject (GET /subjects/{subject}/key-stages or GET /subjects/{subject}/years); subject-scoped lessons or units (GET /key-stages/{keyStage}/subject/{subject}/lessons or GET /key-stages/{keyStage}/subject/{subject}/units); the detail of one sequence (GET /sequences/{sequence}).

Example: subject=maths.`,
      },
    })
    .input(subjectRequestSchema)
    .output(subjectResponseSchema)
    .query(({ input }) => {
      return getSubjectFromProgrammes(input.subject);
    }),
  getSubjectKeyStages: v0Procedure
    .meta({
      openapi: {
        tags: ['lists'],
        method: 'GET',
        summary: 'Key stages for a subject',
        path: '/subjects/{subject}/key-stages',
        errorResponses,
        description: `Use when you only need the key stages where this subject is available. Returns key-stage titles and slugs.

Not for: every key stage (GET /key-stages); the subject record (GET /subjects/{subject}).

Example: 'subject=history'.`,
      },
    })
    .input(subjectKeyStagesRequestSchema)
    .output(subjectKeyStagesResponseSchema)
    .query(async ({ input }) => {
      return phaseToKeyStages(await getSubjectPhase(input.subject));
    }),
  getSubjectYears: v0Procedure
    .meta({
      openapi: {
        tags: ['lists'],
        method: 'GET',
        summary: 'Year groups for a subject',
        path: '/subjects/{subject}/years',
        errorResponses,
        description: `Use when you only need the year groups where this subject is available. Returns an array of year numbers, derived from the subject's key stages.

Not for: the subject record (GET /subjects/{subject}); key stages rather than year groups (GET /subjects/{subject}/key-stages).

Example: 'subject=english'.`,
      },
    })
    .input(subjectYearsRequestSchema)
    .output(subjectYearsResponseSchema)
    .query(async ({ input }) => {
      return yearsFromKeyStages(
        phaseToKeyStages(await getSubjectPhase(input.subject)),
      );
    }),
});
