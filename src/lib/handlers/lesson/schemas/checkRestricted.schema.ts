import * as z from 'zod/v4';
import { collapsedRestrictionStatuses } from '@/lib/queryGate';
import { gatedAssetTypes } from '@/lib/queryGateData/assetTypeRestrictions';

const restrictionEnum = z.enum(collapsedRestrictionStatuses);

/**
 * The `detailed` query parameter of the check-restricted endpoints. A string
 * enum rather than a boolean: query values arrive as strings, and coercing one
 * to a boolean would read `false` as true.
 *
 * No example on purpose: the playground pre-fills a parameter's example, which
 * would switch detail on for every "Try it out". Callers opt in.
 */
export const detailedQuerySchema = z
  .enum(['true', '1', 'false', '0'])
  .optional()
  .describe(
    'Pass `true` or `1` to return, for each lesson, the restriction status of every asset type rather than a single status for the whole lesson',
  );

export function isDetailed(
  detailed: z.infer<typeof detailedQuerySchema>,
): boolean {
  return detailed === 'true' || detailed === '1';
}

export const checkRestrictedLessonsResponseSchema = z
  .record(z.string(), restrictionEnum)
  .meta({
    example: {
      'joining-using-and': 'ogl-compatible',
      'restricted-lesson': 'restricted',
    },
  });

/** A record keyed by an enum is exhaustive: every asset type is present. */
const assetRestrictionStatusesSchema = z
  .record(gatedAssetTypes, restrictionEnum)
  .describe('The restriction status of each asset type of the lesson');

const detailedExample = Object.fromEntries(
  gatedAssetTypes.options.map((type) => [
    type,
    type === 'video' || type === 'transcript' ? 'restricted' : 'ogl-compatible',
  ]),
);

export const checkRestrictedLessonsDetailedResponseSchema = z
  .record(z.string(), assetRestrictionStatusesSchema)
  .describe('Returned when `detailed` is `true` or `1`')
  .meta({ example: { 'an-english-lesson': detailedExample } });

/** The shape depends on `detailed`, so the response is either of the two. */
export const checkRestrictedLessonsAnyResponseSchema = z
  .union([
    checkRestrictedLessonsResponseSchema,
    checkRestrictedLessonsDetailedResponseSchema,
  ])
  .meta({
    example: { 'an-english-lesson': detailedExample },
  });
