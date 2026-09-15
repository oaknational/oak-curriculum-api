import { v0Procedure } from '@/lib/protect';
import { router } from '@/lib/trpc';
import type { Sequence, SequenceView } from '@/lib/owaClient';
import {
  getClient,
  gql,
  sequenceView,
  sequenceViewWhereInput,
} from '@/lib/owaClient';
import { parseSubjectPhaseSlug } from '../../sequenceSlugParser';
import { examBoards } from '../../oakConsts';
import type {
  Category,
  ExamSubjectsWithoutTiers,
  ExamSubjectsWithTiers,
  SequenceSchema,
  YearSequence,
  Tier,
  Unit,
} from '@/lib/handlers/sequences/types';
import { errorResponses } from '@/lib/errorResponses';

import {
  sequenceUnitsRequestSchema,
  sequenceUnitsResponseSchema,
} from './schemas';
import {
  subjectSequenceRequestSchema,
  subjectSequenceResponseSchema,
} from '@/lib/handlers/subjects/schemas';
import { TRPCError } from '@trpc/server';
import { getSubjectFromProgrammes } from '../subjects/helpers';

interface ExamBoardRef {
  title: string;
  slug: string;
}
type SequenceWithExamBoards = Sequence & { _examBoards?: ExamBoardRef[] };

interface WhereCondition {
  _and: {
    _or?: {
      subject_slug?: { _eq: string };
      subject_parent_slug?: { _eq: string };
    }[];
    phase_slug?: { _eq: string };
    state?: { _eq: string };
    year?: { _eq: string };
    non_curriculum?: { _eq: boolean };
  }[];
}

export function sequenceWhere(
  sequence: string,
  year?: string,
  ignorePathway = false,
): WhereCondition {
  const { phaseSlug, subjectSlug, ks4OptionSlug } =
    parseSubjectPhaseSlug(sequence);

  const baseWhere: WhereCondition = {
    _and: [
      {
        _or: [
          { subject_slug: { _eq: subjectSlug } },
          { subject_parent_slug: { _eq: subjectSlug } },
        ],
      },
      { phase_slug: { _eq: phaseSlug } },
      { state: { _eq: 'published' } },
      { non_curriculum: { _eq: false } },
    ],
  };

  if (year) {
    baseWhere._and.push({ year: { _eq: year } });
  }

  const isExamboard = ks4OptionSlug
    ? examBoards.includes(ks4OptionSlug)
    : false;

  const examboardSlug = isExamboard ? ks4OptionSlug : null;
  const pathwaySlug = !isExamboard ? ks4OptionSlug : null;

  const examboardCondition = examboardSlug
    ? {
        _or: [
          { examboard_slug: { _eq: examboardSlug } },
          {
            _and: [
              { examboard_slug: { _is_null: true } },
              {
                _or: [
                  { pathway_slug: { _neq: 'core' } },
                  { pathway_slug: { _is_null: true } },
                ],
              },
            ],
          },
        ],
      }
    : { examboard_slug: { _is_null: true } };

  const pathwayCondition = pathwaySlug
    ? {
        _or: [
          { pathway_slug: { _eq: pathwaySlug } },
          { pathway_slug: { _is_null: true } },
        ],
      }
    : { pathway_slug: { _is_null: true } };

  const res = {
    ...baseWhere,
    _and: [...baseWhere._and],
  };

  if (isExamboard) {
    res._and.push(examboardCondition as WhereCondition['_and'][0]);
  } else if (!ignorePathway) {
    res._and.push(pathwayCondition as WhereCondition['_and'][0]);
  }

  return res;
}

async function hasPublishedRowsForSequenceSlug(args: {
  subjectSlug: string;
  phaseSlug: string;
  ks4OptionSlug: string | null;
}): Promise<boolean> {
  const client = getClient();
  const baseAnd = [
    {
      _or: [
        { subject_slug: { _eq: args.subjectSlug } },
        { subject_parent_slug: { _eq: args.subjectSlug } },
      ],
    },
    { phase_slug: { _eq: args.phaseSlug } },
    { state: { _eq: 'published' } },
    { non_curriculum: { _eq: false } },
  ];

  let variantCondition: Record<string, unknown>;
  if (args.phaseSlug === 'primary') {
    if (args.ks4OptionSlug !== null) {
      return false;
    }
    variantCondition = {};
  } else if (args.phaseSlug === 'secondary') {
    const ks4Condition = { keystage_slug: { _eq: 'ks4' } };
    if (args.ks4OptionSlug === null) {
      variantCondition = {
        _and: [
          ks4Condition,
          { examboard_slug: { _is_null: true } },
          { pathway_slug: { _is_null: true } },
        ],
      };
    } else if (examBoards.includes(args.ks4OptionSlug)) {
      variantCondition = {
        _and: [ks4Condition, { examboard_slug: { _eq: args.ks4OptionSlug } }],
      };
    } else {
      variantCondition = {
        _and: [ks4Condition, { pathway_slug: { _eq: args.ks4OptionSlug } }],
      };
    }
  } else {
    return false;
  }

  const query = gql`
    query ($where: ${sequenceViewWhereInput}!) {
      ${sequenceView}(where: $where, limit: 1) {
        slug
      }
    }
  `;

  const where = {
    _and: variantCondition._and ? [...baseAnd, variantCondition] : baseAnd,
  };

  const res: SequenceView = await client.request(query, { where });
  return (res[sequenceView] ?? []).length > 0;
}

export const getSequences = router({
  getSubjectSequence: v0Procedure
    .meta({
      openapi: {
        tags: ['lists', 'sequences'],
        method: 'GET',
        summary: 'Sequencing information for a given sequence slug',
        path: '/sequences/{sequence}',
        errorResponses,
        description: `Use when you have a sequence slug and need the sequence-level summary. A sequence is a subject's curriculum across a phase (e.g. maths-primary, science-secondary-aqa); it spans one or more National Curriculum schemes and contains one programme per year group. Get sequence slugs from GET /subjects or GET /subjects/{subject} (the sequenceSlugs field). Returns slug, phase, key stages, years, and any KS4 programme factors (exam board, tier, child subject, pathway) needed to interpret the programmes within it.

Not for: the programmes within this sequence (GET /subjects/{subject}/programmes); the unit sequence for one programme (GET /programmes/{programme}/units); all units across the sequence (GET /sequences/{sequence}/units); subject-level catalogue data (GET /subjects or GET /subjects/{subject}).

Example: sequence=maths-primary or science-secondary-aqa.`,
      },
    })
    .input(subjectSequenceRequestSchema)
    .output(subjectSequenceResponseSchema)
    .query(async ({ input }) => {
      const rawSlug = input.sequence;

      let subjectSlug: string;
      let phaseSlug: string;
      let ks4OptionSlug: string | null;

      try {
        ({ subjectSlug, phaseSlug, ks4OptionSlug } =
          parseSubjectPhaseSlug(rawSlug));
      } catch {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sequence not found',
        });
      }

      const hasRows = await hasPublishedRowsForSequenceSlug({
        subjectSlug,
        phaseSlug,
        ks4OptionSlug,
      });

      if (!hasRows) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sequence not found',
        });
      }

      const subject = await getSubjectFromProgrammes(subjectSlug);
      const sequence = subject.sequenceSlugs.find(
        (item) => item.sequenceSlug === rawSlug,
      );

      if (!sequence) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sequence not found',
        });
      }

      return {
        ...sequence,
        ks4ProgrammeFactors: subject.ks4ProgrammeFactors,
      };
    }),
  getSequenceUnits: v0Procedure
    .meta({
      openapi: {
        tags: ['units', 'sequences'],
        method: 'GET',
        summary: 'Units in a curriculum sequence',
        path: '/sequences/{sequence}/units',
        description: `Use when you want every unit across a whole sequence — all programmes combined, in unit sequence order. Returns units grouped by programme (year group) in unit sequence order. If the sequence slug includes an exam board (e.g. science-secondary-aqa), units are scoped to that exam board. Secondary sequences also expose tiers, pathways, and exam subjects where applicable. Pass year as an optional filter to return only that year's units (across all KS4 factor combinations).

Not for: units in a single programme (GET /programmes/{programme}/units); a flat list of units for a key stage + subject without programme structure or unit sequence order (GET /key-stages/{keyStage}/subject/{subject}/units); the programmes within this sequence (GET /subjects/{subject}/programmes); a single unit (GET /units/{unit}/summary); units in a thread (GET /threads/{threadSlug}/units).

Example: sequence=science-secondary-aqa or maths-primary.`,
        errorResponses,
      },
    })
    .input(sequenceUnitsRequestSchema)
    .output(sequenceUnitsResponseSchema)
    .query(async ({ input }) => {
      const client = getClient();

      let yearFilter = 0;

      if (input.year === 'all-years') {
        yearFilter = 0;
      } else if (input.year && typeof input.year === 'string') {
        yearFilter = parseInt(input.year, 10);
      }

      const { subjectSlug, ks4OptionSlug } = parseSubjectPhaseSlug(
        input.sequence,
      );

      const where = sequenceWhere(input.sequence);

      const query = gql`
      query ($where: ${sequenceViewWhereInput}!) {
        ${sequenceView}(
          where: $where
          order_by: { order: asc }
        ) {
          title
          threads
          slug
          examboard
          examboard_slug
          keystage_slug
          order
          pathway
          pathway_slug
          phase
          subject
          subjectcategories
          subject_parent
          subject_slug
          tier
          features
          actions
          tier_slug
          unit_options
          year
        }
      }`;

      const res: SequenceView = await client.request(query, { where });

      // When a sequence isn't pinned to a specific exam board (e.g.
      // `science-secondary` rather than `science-secondary-aqa`), the query
      // doesn't filter `examboard_slug`, so KS4 units come back once per exam
      // board (AQA, Edexcel, OCR). The response shape doesn't carry exam
      // board at the row level, so collapse to a single row per
      // (subject, tier, pathway, year, slug) and, when the caller didn't pin
      // an exam board, collect the exam boards each unit appears in so we can
      // expose them on the output.
      const exposeExamBoards = !ks4OptionSlug;
      const dedupedMap = new Map<string, SequenceWithExamBoards>();
      for (const row of res[sequenceView]) {
        const key = [
          row.subject_slug,
          row.tier_slug ?? '',
          row.pathway_slug ?? '',
          row.year,
          row.slug,
        ].join('|');
        const existing = dedupedMap.get(key);
        if (existing) {
          if (exposeExamBoards && row.examboard_slug) {
            const boards = existing._examBoards ?? [];
            if (!boards.some((b) => b.slug === row.examboard_slug)) {
              boards.push({
                title: row.examboard,
                slug: row.examboard_slug,
              });
            }
            existing._examBoards = boards;
          }
          continue;
        }
        const cloned: SequenceWithExamBoards = { ...row };
        if (exposeExamBoards && row.examboard_slug) {
          cloned._examBoards = [
            { title: row.examboard, slug: row.examboard_slug },
          ];
        }
        dedupedMap.set(key, cloned);
      }
      const rawData = Array.from(dedupedMap.values());

      const years = Array.from(
        rawData.reduce<Set<number>>(
          (acc, curr) => acc.add(Number(curr.year)),
          new Set(),
        ),
      )
        .sort((a, b) => a - b)
        .filter((year) => {
          if (yearFilter) {
            return year === yearFilter;
          }
          return true;
        });

      const result: SequenceSchema[] = [];

      const ks4Years = years.filter((year) => year >= 10);

      // this is (currently) _only_ used in PE (for swimming)
      const exclusionYearUnits: YearSequence = {
        year: 'all-years',
        title: undefined,
        units: [],
      };

      const applyExclusion =
        yearFilter === 0 && subjectSlug === 'physical-education';

      years.forEach((year) => {
        const yearUnits = rawData
          .filter((_) => Number(_.year) === year)
          .filter((_) => {
            if (_.actions?.group_units_as) {
              exclusionYearUnits.title = _.actions.group_units_as;
            }

            if (!applyExclusion) {
              // early return - we don't need to split the units
              return true;
            }

            if (!_.features?.pe_swimming) {
              return true;
            }

            exclusionYearUnits.units.push(formatUnit(_));

            // then remove the swimming unit from the normal year list
            return false;
          });

        let hasExamSubjectOverride = false;

        /**
         * if years is 0 (i.e. all) _AND_ the subject is PE then
         * 1. we need to _ignore_ any swimming units from the "normal" results
         * 2. we need to separate out the swimming units into their own "magic" year
         */

        // then we're going to check for examSubjects / child subjects
        const seen = new Set<string>();

        // let's find out how many subjects there are,
        // if there's only one, then we don't break it into examSubjects
        for (const { subject, subject_parent, actions } of yearUnits) {
          if (subject_parent && !seen.has(subject)) {
            seen.add(subject);
          }

          // checking for programme_override_exclusions for subjects
          if (actions?.programme_field_overrides?.subject) {
            seen.add(actions.programme_field_overrides.subject);
            hasExamSubjectOverride = true;
          }
        }

        // let's use the first unit in the year sequence

        const hasTiers = !!yearUnits[0].tier_slug;
        const hasExamSubjects = seen.size > 1 || hasExamSubjectOverride;

        if (!ks4Years.includes(year) || (!hasExamSubjects && !hasTiers)) {
          const units = formatUnits(yearUnits);

          result.push({
            year,
            units,
          });
          return; // early return
        }

        if (!hasExamSubjects && hasTiers) {
          const tiers = formatUnitsForTiers(yearUnits);

          result.push({
            year,
            tiers,
          });
          return;
        }

        const examSubjects: (
          ExamSubjectsWithTiers | ExamSubjectsWithoutTiers
        )[] = [];

        // reset seen
        seen.clear();

        for (const { subject, subject_slug, actions } of yearUnits) {
          const programmeFieldSubject =
            actions?.programme_field_overrides?.subject;
          const examSubjectTitle = programmeFieldSubject || subject;

          if (!seen.has(examSubjectTitle)) {
            seen.add(examSubjectTitle);

            if (hasTiers) {
              examSubjects.push({
                examSubjectTitle,
                examSubjectSlug: subject_slug,
                tiers: formatUnitsForTiers(yearUnits, subject).sort((a, b) =>
                  a.tierSlug < b.tierSlug ? -1 : 1,
                ),
              });
            } else {
              examSubjects.push({
                examSubjectTitle,
                examSubjectSlug: subject_slug,
                units: formatUnits(yearUnits, (_) => _.subject === subject),
              });
            }
          }
        }

        result.push({
          year,
          examSubjects,
        });
      });

      if (applyExclusion && exclusionYearUnits.units.length > 0) {
        result.unshift(exclusionYearUnits);
      }

      return result;
    }),
});

export function formatUnit(unit: SequenceWithExamBoards): Unit {
  let categories: Category[] | undefined;

  const threads =
    unit.threads?.length > 0
      ? Array.from(unit.threads).map(({ title, slug, order }) => ({
          threadTitle: title,
          threadSlug: slug,
          order,
        }))
      : undefined;

  if (unit.subjectcategories && unit.subjectcategories.length > 0) {
    categories = unit.subjectcategories.map((cat) => ({
      categoryTitle: cat.title,
      categorySlug: cat.slug,
    }));
  }

  const examBoards = unit._examBoards?.length ? unit._examBoards : undefined;

  if (unit.unit_options && unit.unit_options.length > 0) {
    return {
      unitTitle: unit.title,
      unitOrder: unit.order,
      unitOptions: unit.unit_options.map((option) => ({
        unitSlug: option.slug,
        unitTitle: option.title,
      })),
      threads,
      categories,
      examBoards,
    };
  } else {
    return {
      unitSlug: unit.slug,
      unitTitle: unit.title,
      unitOrder: unit.order,
      threads,
      categories,
      examBoards,
    };
  }
}

type UnitFilter = (unit: SequenceWithExamBoards) => boolean;

function formatUnits(
  units: SequenceWithExamBoards[],
  filter: UnitFilter = () => true,
): Unit[] {
  return units.filter(filter).map(formatUnit);
}

function formatUnitsForTiers(
  units: SequenceWithExamBoards[],
  subject?: string,
): Tier[] {
  const tiers = units.reduce<Tier[]>((acc, curr) => {
    const { tier_slug: tierSlug, tier: tierTitle } = curr;

    const existing = acc.find((_) => _.tierSlug === tierSlug);

    if (!existing) {
      acc.push({
        tierSlug,
        tierTitle,
        units: formatUnits(
          units,
          (_) =>
            _.tier_slug === tierSlug &&
            (subject ? _.subject === subject : true),
        ),
      });
    }

    return acc;
  }, []);

  return tiers;
}
