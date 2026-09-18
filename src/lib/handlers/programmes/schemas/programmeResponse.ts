import * as z from 'zod/v4';
import example from './programmeResponse.example.json' with { type: 'json' };

export const programmeResponseSchema = z
  .object({
    examboardSlug: z.string().nullable(),
    examboardTitle: z.string().nullable(),
    keystageSlug: z.string(),
    keystageTitle: z.string(),
    pathwaySlug: z.string().nullable(),
    pathwayTitle: z.string().nullable(),
    phaseSlug: z.string(),
    phaseTitle: z.string(),
    subjectSlug: z.string(),
    subjectTitle: z.string(),
    tierSlug: z.string().nullable(),
    tierTitle: z.string().nullable(),
    yearSlug: z.string(),
    yearTitle: z.string(),
  })
  .meta({
    example,
  });
