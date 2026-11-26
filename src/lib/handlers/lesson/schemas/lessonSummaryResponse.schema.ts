import * as z from 'zod/v4';
import { canonicalUrlSchema, oakUrlSchema } from '@/lib/handlers/commonTypes';
import { unitProgrammeFactorsSchema } from '@/lib/handlers/unitProgrammeFactors';
import example from './lessonSummaryResponse.example.json' with { type: 'json' };

export const lessonSummaryResponseSchema = z
  .object({
    lessonTitle: z.string().meta({ description: 'The lesson title' }),
    canonicalUrl: canonicalUrlSchema,
    oakUrl: oakUrlSchema,
    units: z
      .array(
        z.object({
          unitSlug: z
            .string()
            .meta({ description: 'The unit slug identifier' }),
          unitTitle: z.string().meta({ description: 'The unit title' }),
          programmeFactors: unitProgrammeFactorsSchema
            .describe(
              'The programme-factor values that identify which variant of the unit this lesson sits in. Omitted when the unit has no programme factors.',
            )
            .optional(),
        }),
      )
      .meta({
        description:
          'All the units (including programme variants) this lesson is part of. Each entry is a unique combination of unit slug and programme factors.',
      }),
    subjectSlug: z
      .string()
      .meta({ description: 'The subject slug identifier' }),
    subjectTitle: z
      .string()
      .meta({ description: 'The subject slug identifier' }),
    keyStageSlug: z
      .string()
      .meta({ description: 'The key stage slug identifier' }),
    keyStageTitle: z.string().meta({ description: 'The key stage title' }),
    lessonKeywords: z
      .array(
        z.object({
          keyword: z.string().meta({ description: 'The keyword' }),
          description: z
            .string()
            .meta({ description: 'A definition of the keyword' }),
        }),
      )
      .meta({ description: "The lesson's keywords and their descriptions" }),
    keyLearningPoints: z
      .array(
        z.object({
          keyLearningPoint: z
            .string()
            .meta({ description: 'A key learning point' }),
        }),
      )
      .meta({ description: "The lesson's key learning points" }),
    misconceptionsAndCommonMistakes: z
      .array(
        z.object({
          misconception: z
            .string()
            .meta({ description: 'A common misconception' }),
          response: z
            .string()
            .describe('Suggested teacher response to a common misconception'),
        }),
      )
      .meta({
        description:
          'The lesson’s anticipated common misconceptions and suggested teacher responses',
      }),
    pupilLessonOutcome: z.string().optional().meta({
      description: 'Suggested teacher response to a common misconception',
    }),
    teacherTips: z
      .array(
        z
          .object({ teacherTip: z.string() })
          .meta({ description: 'A teaching tip' }),
      )
      .meta({ description: 'Helpful teaching tips for the lesson' }),
    contentGuidance: z
      .array(
        z.object({
          contentGuidanceArea: z
            .string()
            .meta({ description: 'Category of content guidance' }),
          supervisionlevel_id: z.number().meta({
            description:
              'The ID of the supervision level for the identified type of content. See ‘What are the types of content guidance?’ for more information.',
          }),
          contentGuidanceLabel: z
            .string()
            .meta({ description: 'Content guidance label' }),
          contentGuidanceDescription: z.string().meta({
            description:
              'A detailed description of the type of content that we suggest needs guidance.',
          }),
        }),
      )
      .or(z.null())
      .meta({
        description:
          'Full guidance about the types of lesson content for the teacher to consider (where appropriate)',
      }),
    supervisionLevel: z.string().or(z.null()).meta({
      description:
        'The ID of the supervision level for the identified type of content. See ‘What are the types of content guidance?’ for more information.',
    }),
    downloadsAvailable: z.boolean().meta({
      description:
        'Whether the lesson currently has any downloadable assets available.',
    }),
  })
  .meta({ example });

export type LessonSummaryResponseType = z.infer<
  typeof lessonSummaryResponseSchema
>;

/**
 * The v1 lesson summary: the v0 shape plus `equipment`.
 *
 * Kept as an extension rather than a field on the shared schema, because
 * `/api/v0` is frozen and its contract must not gain fields. See
 * docs/RELEASING.md, "Superseding an endpoint".
 */
export const lessonSummaryResponseSchemaV1 = lessonSummaryResponseSchema
  .extend({
    equipment: z.string().or(z.null()).meta({
      description:
        'Equipment and resources needed to teach the lesson, or null when none are listed.',
      example:
        'An object to control - which could be a ball or rolled up socks, an implement to hit the ball with (e.g. a book, racket or pan) and optional own equipment to make your own target game.',
    }),
  })
  .meta({ example: { ...example, equipment: null } });

export type LessonSummaryResponseV1Type = z.infer<
  typeof lessonSummaryResponseSchemaV1
>;
