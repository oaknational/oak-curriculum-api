import { TRPCError } from '@trpc/server';
import { ks4Options, phases } from './oakConsts';
import { isSubjectAllowed } from './queryGate';

export interface CurriculumSelectionSlugs {
  phaseSlug: string;
  subjectSlug: string;
  ks4OptionSlug: string | null;
}

// modified from https://github.com/oaknational/Oak-Web-Application/blob/4fb366fbaa4d9cb3187a682ad9d4eb292db89db1/src/utils/curriculum/slugs.ts#L10-L33
export const parseSubjectPhaseSlug = (
  slug: string,
): CurriculumSelectionSlugs => {
  const parts = slug.split('-');

  const phaseIndex = parts.findIndex((part) => phases.includes(part));

  if (phaseIndex === -1) {
    throw new TRPCError({
      message: `Invalid slug, must include 'primary' or 'secondary': ${slug}`,
      code: 'BAD_REQUEST',
    });
  }

  const res = {
    phaseSlug: parts[phaseIndex],
    subjectSlug: parts.slice(0, phaseIndex).join('-'),
    ks4OptionSlug: parts[phaseIndex + 1] ?? null,
  };

  // validate the subject and ks4 options
  if (!isSubjectAllowed(res.subjectSlug)) {
    throw new TRPCError({
      message: `Invalid subject: ${res.subjectSlug}`,
      code: 'BAD_REQUEST',
    });
  }

  if (res.ks4OptionSlug && !ks4Options.includes(res.ks4OptionSlug)) {
    throw new TRPCError({
      message: `Invalid exam board: ${res.ks4OptionSlug}`,
      code: 'BAD_REQUEST',
    });
  }

  return res;
};
