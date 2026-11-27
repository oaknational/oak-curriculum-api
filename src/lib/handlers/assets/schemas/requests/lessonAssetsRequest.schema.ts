import * as z from 'zod/v4';

import { downloadTypeEnum } from '@/lib/handlers/assets/types';
import { lessonSlugSchema } from '@/lib/handlers/commonTypes';

export const lessonAssetsRequestSchema = z.object({
  lesson: lessonSlugSchema,
  type: downloadTypeEnum.optional().meta({
    description: `Optional asset type specifier

Available values: slideDeck, exitQuiz, exitQuizAnswers, starterQuiz, starterQuizAnswers, supplementaryResource, video, worksheet, worksheetAnswers, lessonGuide`,
  }),
});
