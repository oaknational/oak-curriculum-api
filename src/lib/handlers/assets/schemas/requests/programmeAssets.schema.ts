import * as z from 'zod/v4';
import { downloadTypeEnum } from '@/lib/handlers/assets/types';
import { limitSchema, offsetSchema } from '@/lib/handlers/commonTypes';
import example from './programmeAssets.example.json' with { type: 'json' };

export const programmeAssetsRequestSchema = z
  .object({
    programme: z.string().meta({
      description: 'The programme slug identifier',
    }),
    offset: offsetSchema,
    limit: limitSchema,
    type: downloadTypeEnum.optional(),
  })
  .meta({ example });
