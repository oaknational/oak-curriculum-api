import { lessonsAssetsType } from '@/lib/handlers/assets/types';
import example from './programmeAssets.example.json' with { type: 'json' };

export const programmeAssetsResponseSchema = lessonsAssetsType.meta({
  example,
});
