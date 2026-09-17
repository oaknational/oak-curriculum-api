import { unitListSchema } from '@/lib/handlers/threads/types';
import example from './threadUnitsResponse.example.json' with { type: 'json' };

export const threadUnitsResponseSchema = unitListSchema.meta({ example });
