import * as z from 'zod/v4';

import {
  lessonSlugSchema,
  lessonTitleSchema,
} from '@/lib/handlers/commonTypes';

import example from './schemas/sharedQuiz.example.json' with { type: 'json' };

export const multipleChoiceLit = z.literal('multiple-choice');
export const shortAnswerLit = z.literal('short-answer');
export const matchAnswerLit = z.literal('match');
export const orderAnswerLit = z.literal('order');

export const availableQuestionTypes = z.union([
  multipleChoiceLit,
  shortAnswerLit,
  matchAnswerLit,
  orderAnswerLit,
]);

export const imageContent = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  alt: z.string().optional(),
  text: z
    .string()
    .meta({
      description: 'Supplementary text for the image, if any',
    })
    .optional(),
  // RS disabled license for now until we have final answer on how we deal
  // with unknown/uncategorised licenses
  attribution: z.string().optional(),

  // license: z
  //   .object({
  //     source: z.string().optional(),
  //     attribution_required: z.boolean().optional(),
  //     usageRestrictions: z.string().optional(),
  //     usage_notes: z.string().optional(),
  //   })
  //   .optional(),
});

export const textAnswer = z.object({
  type: z.literal('text').meta({
    description: `The format of the quiz answer \nNote: currently, we are only returning text-based quiz answers. In the future, we will also have image-based questions available.`,
  }),
  content: z.string().meta({ description: 'Quiz question answer' }),
});

export const imageAnswer = z.object({
  type: z.literal('image'),
  content: imageContent,
});

export const multipleChoiceAnswer = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text').meta({
      description: `The format of the quiz answer \nNote: currently, we are only returning text-based quiz answers. In the future, we will also have image-based questions available.`,
    }),
    content: z.string().meta({ description: 'Quiz question answer' }),
    distractor: z.boolean().meta({
      description:
        'Whether the multiple choice question response is the correct answer (false) or is a distractor (true)',
    }),
  }),
  z.object({
    type: z.literal('image'),
    content: imageContent,
    distractor: z.boolean().meta({
      description:
        'Whether the multiple choice question response is the correct answer (false) or is a distractor (true)',
    }),
  }),
]);

export const shortAnswer = textAnswer;

export const matchAnswer = z.object({
  matchOption: textAnswer.meta({ description: 'Matching options (LHS)' }),
  correctChoice: textAnswer.meta({
    description: 'Matching options (RHS), indicating the correct choice',
  }),
});

export const orderAnswer = z
  .object({
    order: z.number().meta({
      description: 'Indicates the correct ordering of the response',
    }),
  })
  .and(textAnswer);

export const questionZod = z.discriminatedUnion('questionType', [
  z
    .object({
      question: z.string().meta({ description: 'The question text' }),
      questionType: multipleChoiceLit,
      questionImage: imageContent.optional(),
      answers: z.array(multipleChoiceAnswer),
    })
    .describe(
      'Multiple choice answer allows for one or more than one answer to be correct as defined by the distractor field being set to false',
    ),
  z
    .object({
      question: z.string().meta({ description: 'The question text' }),
      questionType: shortAnswerLit,
      questionImage: imageContent.optional(),
      answers: z.array(shortAnswer),
    })
    .describe(
      'Short answers allow students to enter a free text answer, and the answers array contains a list of acceptable answers',
    ),
  z
    .object({
      question: z.string().meta({ description: 'The question text' }),
      questionType: matchAnswerLit,
      questionImage: imageContent.optional(),
      answers: z.array(matchAnswer),
    })
    .describe(
      'The student is offered a list from the `match_option` field in the answers array, and must correctly match them to the `correct_choice` value',
    ),
  z
    .object({
      question: z.string().meta({ description: 'The question text' }),
      questionType: orderAnswerLit,
      questionImage: imageContent.optional(),
      answers: z.array(orderAnswer),
    })
    .describe(
      'The student is offered a list of items to order, and must correctly order them according to the `order` field. When presenting the answer options to the student, you should randomise the order of the items',
    ),
]);

export const starterQuizSchema = z.array(questionZod).meta({
  description: 'The starter quiz questions - which test prior knowledge',
  example: example.starterQuiz,
});

export const exitQuizSchema = z.array(questionZod).meta({
  description:
    'The exit quiz questions - which test on the knowledge learned in the lesson',
  example: example.exitQuiz,
});

export const questionsSchema = z.array(
  z.object({
    lessonSlug: lessonSlugSchema,
    lessonTitle: lessonTitleSchema,
    starterQuiz: starterQuizSchema,
    exitQuiz: exitQuizSchema,
  }),
);

export const questionFilterSchema = z.enum(['images']).meta({
  description:
    'Optional filter for question results. Use `images` to return only questions with a question image or image answer.',
});

export type Question = z.infer<typeof questionZod>;
export type QuestionFilter = z.infer<typeof questionFilterSchema>;
export type QuizKey = 'exitQuiz' | 'starterQuiz';
export type TextAnswer = z.infer<typeof textAnswer>;
export type MatchAnswer = z.infer<typeof matchAnswer>;
export type OrderAnswer = z.infer<typeof orderAnswer>;
export type MultipleChoiceAnswer = z.infer<typeof multipleChoiceAnswer>;
export type ImageDataSchemaType = z.infer<typeof imageContent>;
