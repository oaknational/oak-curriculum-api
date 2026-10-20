import { GraphQLClient } from 'graphql-request';

export { gql } from 'graphql-request';

export const currentCycle = '2';

export const lessonView = 'published_mv_lesson_openapi_1_2_3';
export const lessonContentView = 'published_mv_lesson_content_published_5_0_0';
export const downloadView = 'published_mv_openapi_downloads_1_0_0';
export const threadView = 'published_mv_threads_2';
export const unitVariantLessonsView =
  'published_mv_synthetic_unitvariant_lessons_by_year_12_0_0';
export const lessonViewTable = 'published.mv_lesson_openapi_1_2_3';
export const lessonContentViewTable =
  'published.mv_lesson_content_published_5_0_0';
export const subjectPhaseView = 'published_mv_subject_phase_options_0_11';
export const sequenceView = 'published_mv_curriculum_sequence_b_13_0_21';
export const lessonSearchView =
  'published_function__table__mv_lesson_openapi_search_1';
export const programmesByYearView =
  'published_mv_synthetic_programmes_by_year_18_2_0';
export const programmesByYearViewTable =
  'published.mv_synthetic_programmes_by_year_18_2_0';
export const lessonOpenApiWithTranscriptsView =
  'published_view_lesson_open_api_with_transcripts_1';

export const lessonRestrictionView = 'published_mv_lesson_restriction_levels_2';

export const sequenceViewWhereInput =
  'published_mv_curriculum_sequence_b_13_0_21_bool_exp';

export const views = [
  lessonView,
  downloadView,
  threadView,
  unitVariantLessonsView,
  subjectPhaseView,
  sequenceView,
  lessonSearchView,
  programmesByYearView,
  lessonRestrictionView,
];

function hasuraHeaders() {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${process.env.OAK_GRAPHQL_SECRET}`,
  };
}

export function getClient(): GraphQLClient {
  return new GraphQLClient(`${process.env.OAK_GRAPHQL_HOST}/v1/graphql`, {
    headers: hasuraHeaders(),
  });
}

/**
 * enum LessonRestrictionLevel based on:
 * OGL compatible, OGL equivalent, Restricted, Highly restricted
 */

export enum LessonRestrictionLevel {
  OGL_COMPATIBLE = 'OGL compatible',
  OGL_EQUIVALENT = 'OGL equivalent',
  RESTRICTED = 'Restricted',
  HIGHLY_RESTRICTED = 'Highly restricted',
}

export interface LessonRestrictionView {
  [lessonRestrictionView]: LessonRestriction[];
}

export interface LessonRestriction {
  slug: string;

  /** not used yet */
  tpc_downloadablefiles_max_restriction?: LessonRestrictionLevel;

  /** Copyright on any assets (different from downloadable files) */
  tpc_media_max_restriction?: LessonRestrictionLevel;

  /** Question image copyright */
  tpc_quizimages_max_restriction?: LessonRestrictionLevel;

  /** Copyright text restriction level */
  tpc_works_max_restriction?: LessonRestrictionLevel;

  features?: LessonFeatures;
}

/**
 * The `features` JSONB column. Hasura returns it as-is, so the column itself
 * and every member of it is absent until the view sets it — always read through
 * `?.` and compare explicitly rather than trusting a member to be there.
 */
export interface LessonFeatures {
  /** Restricts every asset type of the lesson, whatever its restriction levels say */
  has_copyright_conflict?: boolean;
  pe_swimming?: boolean;
}

export interface SubjectPhaseView {
  [subjectPhaseView]: SubjectPhase[];
}

export interface SyntheticProgrammesByYearView {
  [programmesByYearView]: SyntheticProgrammeByYear[];
}

export interface LessonWithTranscriptsView {
  [lessonOpenApiWithTranscriptsView]: LessonWithTranscripts[];
}

export interface SyntheticProgrammeByYear {
  programme_slug: string;
  programme_fields: SyntheticProgrammeFields;
}

export interface SyntheticProgrammeFields {
  subject: string;
  subject_slug: string;
  subject_display_order: number | null;
  subject_parent?: string | null;
  subject_parent_slug?: string | null;
  phase: string;
  phase_slug: string;
  phase_display_order: number | null;
  keystage: string;
  keystage_slug: string;
  keystage_description: string;
  keystage_display_order: number | null;
  year: string;
  year_id: number | null;
  year_slug: string;
  year_description: string;
  year_display_order: number | null;
  examboard: string | null;
  examboard_slug: string | null;
  examboard_display_order: number | null;
  pathway: string | null;
  pathway_slug: string | null;
  pathway_display_order: number | null;
  tier: string | null;
  tier_slug: string | null;
  tier_display_order: number | null;
}

export interface LessonSearchView {
  [lessonSearchView]: {
    lessonSlug: string;
    similarity: number;
  }[];
}

export interface SubjectPhase {
  cycle: string;
  title: string;
  slug: string;
  keystages: TitleSlug[];
  phases: TitleSlug[];
  ks4_options: TitleSlug[];
  display_order: number;
}

export interface LessonContentView {
  [lessonContentView]: {
    transcript_sentences: string | null;
    transcript_vtt: string | null;
  }[];
}

export interface SequenceView {
  [sequenceView]: Sequence[];
}

export interface UnitVariantLessonsView {
  [unitVariantLessonsView]: UnitVariantLesson[];
}

export interface ThreadView {
  [threadView]: ThreadSummary[];
}

export type Sequence = TitleSlug & {
  unit_options: (TitleSlug & {
    why_this_why_now: string;
    description: string;
    lessons: (TitleSlug & { order: number; _state: 'new' | 'published' })[];
  })[];
  lessons: (TitleSlug & { order: number; _state: 'new' | 'published' })[];
  title: string;
  description: string;
  slug: string;
  threads: (TitleSlug & {
    order: number;
  })[];
  examboard_slug: string;
  examboard: string;
  keystage_slug: string;
  notes: string;
  national_curriculum_content: { id: string; title: string }[];
  order: number;
  pathway: string;
  pathway_slug: string;
  phase: string;
  phase_slug: string;
  prior_knowledge_requirements: string[];
  subject: string;
  subject_parent: string;
  subject_slug: string;
  subjectcategories: { id: number; title: string; slug: string }[];
  tags: string[];
  tier: string;
  tier_slug: string;
  why_this_why_now: string;
  year: string;
  features: LessonFeatures;
  planned_number_of_lessons: number;
  actions: {
    opt_out: string[];
    group_units_as: string;
    programme_field_overrides: {
      subject: string;
    };
  };
  unitOptionGroup?: string;
  canonicalUrl?: string;
};

export interface UnitVariantLesson {
  unit_title: string; // via unit_data(path:"title")
  unit_slug: string;
  lesson_slug: string; // via lesson_data(path: "slug")
  lesson_title: string; // via lesson_data(path: "lesson_title")
  year_slug: string; // via lesson_data(path: "year_slug")
  phase_slug: string; // via lesson_data(path: "phase_slug")
  keystage_slug: string; // via lesson_data(path: "keystage_slug")
  subject_slug: string; // via lesson_data(path: "subject_slug")
  optionality?: string; // via lesson_data(path: "optionality")
  examboard_slug?: string | null; // via programme_fields(path:"examboard_slug")
  examboard_title?: string | null; // via programme_fields(path:"examboard")
  keywords?: { keyword: string; description: string }[];
  supplementary_data: {
    unit_order: number;
    order_in_unit: number;
  };
}

export type ThreadSummary = TitleSlug & {
  unit_count: number;
};

export type ThreadWithUnits = TitleSlug & {
  thread_units: {
    order: number;
    unit: TitleSlug;
  }[];
};

export interface DownloadView {
  [downloadView]: Download[];
}

export interface Download {
  exitQuiz: SignedAsset;
  exitQuizAnswers: SignedAsset;
  lessonSlug: string;
  lessonTitle: string;
  slideDeck: SignedAsset;
  starterQuizAnswers: SignedAsset;
  starterQuiz: SignedAsset; // note: this is starter_quiz in the graphql response
  supplementaryResource: SignedAsset;
  video: Video;
  worksheet: SignedAsset;
  worksheetAnswers: SignedAsset;
}

export interface SignedAsset {
  ext: string;
  type: string;
  label: string;
  bucket_name: string;
  bucket_path: string;
}

export interface Video {
  ext: string;
  type: string;
  label: string;
  stream: string;
  download: string;
}

export interface TitleSlug {
  title: string;
  slug: string;
}

export interface LessonView {
  [lessonView]: Lesson[];
}

// Note: where any is used, the structure is currently unknown/undocumented
// whilst at the same time, not exposed - I've only included them for completeness
// and debugging - RS 2024-03-20

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Lesson {
  additionalMaterialUrl?: string;
  contentGuidance?: any;
  copyrightContent?: any;
  examBoardSlug?: string;
  examBoardTitle?: string;
  exitQuiz?: Question[];
  exitQuizId?: number;
  hasDownloadableResources?: boolean;
  isLegacy?: boolean;
  isWorksheetLandscape?: boolean;
  keyLearningPoints?: any;
  keyStageSlug?: string;
  keyStageTitle?: string;
  lessonCohort?: string;
  lessonEquipmentAndResources?: any;
  lessonId?: number;
  lessonKeywords?: any;
  lessonSlug?: string;
  lessonTitle?: string;
  misconceptionsAndCommonMistakes?: any;
  nullUnitVariantId?: number;
  presentationUrl?: string;
  programmeSlug?: string;
  pupilLessonOutcome?: string;
  starterQuiz?: Question[];
  starterQuizId?: number;
  subjectSlug?: string;
  subjectTitle?: string;
  supervisionLevel?: string;
  teacherTips?: any;
  tierSlug?: string;
  tierTitle?: string;
  transcriptSentences?: string;
  unitSlug?: string;
  unitTitle?: string;
  unitOrder?: number;
  unitVariantId?: number;
  videoTitle?: string;
  video_object?: any;
  worksheetUrl?: string;
  yearSlug?: string;
  yearTitle?: string;
  tpcMedia?: HasAttribution[];
  tpcWorks?: HasAttribution[];
}

// extend Lesson by adding `transcript_sentences` and `transcript_vtt`
export interface LessonWithTranscripts extends Lesson {
  transcript_sentences?: string;
  transcript_vtt?: string;
  downloadsavailable: boolean;
  lessonSlug: string;
  oakUrl?: string;
  canonicalUrl?: string;
  subjectSlug: string;
  unitSlug: string;
  restricted?: boolean;
  video?: string;
  slideDeck?: string;
  supplementaryResource?: string;
  worksheet?: string;
  worksheetAnswers?: string;
  starterQuizAnswers?: string;
  exitQuizAnswers?: string;
}

export interface HasAttribution {
  attribution?: string;
}

export enum QuestionTypeEnum {
  Text = 'text',
  ExplanatoryText = 'explanatory-text',
  MultipleChoice = 'multiple-choice',
  Match = 'match',
  Order = 'order',
  ShortAnswer = 'short-answer',
}

export type Question = {
  hint: string;
  active: boolean;
  feedback: string;
  questionId: number;
  questionUid: string;
  questionStem: (TextType | ImageStem)[];
} & Answers;

export type Answers =
  MultipleChoiceAnswerObject | MatchObject | OrderObject | ShortAnswerObject;

interface MultipleChoiceAnswerObject {
  questionType: QuestionTypeEnum.MultipleChoice;
  answers: { [QuestionTypeEnum.MultipleChoice]: MultipleChoiceAnswer[] };
}

interface MatchObject {
  questionType: QuestionTypeEnum.Match;
  answers: { [QuestionTypeEnum.Match]: Match[] };
}

interface OrderObject {
  questionType: QuestionTypeEnum.Order;
  answers: { [QuestionTypeEnum.Order]: OrderAnswer[] };
}

interface ShortAnswerObject {
  questionType: QuestionTypeEnum.ShortAnswer;
  answers: { [QuestionTypeEnum.ShortAnswer]: ShortAnswer[] };
}

export interface MultipleChoiceAnswer {
  answer: (TextType | ImageStem)[];
  answer_is_correct: boolean;
}

export interface ShortAnswer {
  answer: TextType[];
  answer_is_default: boolean;
}

export interface Match {
  match_option: TextType[];
  correct_choice: TextType[];
}

export interface TextType {
  type: 'text';
  text: string;
}

export interface ImageStem {
  type: 'image';
  image_object: {
    secure_url: string;
    url: string;
    width: number;
    height: number;
    context?: {
      custom?: {
        alt: string;
      };
    };
    metadata?: any;
  };
}

export interface OrderAnswer {
  answer: TextType[];
  correct_order: number;
}
