import * as z from 'zod/v4';
import { downloadTypeEnum } from '@/lib/handlers/assets/types';

import {
  sequenceSlugSchema,
  sequenceYearSchema,
} from '@/lib/handlers/sequences/types';

export const sequenceAssetsRequestSchema = z.object({
  sequence: sequenceSlugSchema,
  year: sequenceYearSchema,
  type: downloadTypeEnum.optional().meta({
    description: `Optional asset type specifier

Available values: slideDeck, exitQuiz, exitQuizAnswers, starterQuiz, starterQuizAnswers, supplementaryResource, video, worksheet, worksheetAnswers, lessonGuide`,
  }),
});
