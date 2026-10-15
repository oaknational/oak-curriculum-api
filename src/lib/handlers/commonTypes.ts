import * as z from 'zod/v4';
import { keyStageSlugs, subjectSlugs } from '@/lib/keyStageAndSubjects';

export const canonicalUrlSchema = z
  .url()
  .meta({ description: 'The canonical Oak National URL for the lesson' });

export const oakUrlSchema = z
  .url()
  .meta({ description: 'The Oak National URL for the lesson' });

export const subjectSlugSchema = z.enum(subjectSlugs as [string]).meta({
  description:
    "Subject slug to search by, e.g. 'maths' - note that casing is important here (always lowercase)",
  example: 'maths',
});

export const keyStageSlugSchema = z.enum(keyStageSlugs as [string]).meta({
  description: "Key stage slug to filter by, e.g. 'ks3'",
  example: 'ks3',
});

export const offsetSchema = z
  .number()
  .describe(
    'If limiting results returned, this allows you to return the next set of results, starting at the given offset point',
  )
  .meta({ example: 0 })
  .optional()
  .default(0);

export const limitSchema = z
  .number()
  .describe('Limit the number of lessons, e.g. return a maximum of 300 lessons')
  .meta({ example: 20 })
  .lte(300)
  .optional()
  .default(20);

export const keyStageSubjectSchema = z.object({
  keyStage: z
    .enum(keyStageSlugs as [string])
    .describe("Key stage slug to filter by, e.g. 'ks2'"),
  subject: z
    .enum(subjectSlugs as [string])
    .describe(
      "Subject slug to search by, e.g. 'science' - note that casing is important here (always lowercase)",
    ),
});

export const lessonSlugSchema = z.string().meta({
  description: 'The unique slug identifier for the lesson',
  example: 'plotting-non-integer-coordinates',
});

export const lessonTitleSchema = z.string().meta({
  description: 'The title of the lesson',
  example: 'Plotting non-integer coordinates',
});

export const programmeSlugSchema = z.string().meta({
  description: 'The programme slug identifier',
  example: 'maths-secondary-year-8',
});

export type LessonSlugSchema = z.infer<typeof lessonSlugSchema>;
