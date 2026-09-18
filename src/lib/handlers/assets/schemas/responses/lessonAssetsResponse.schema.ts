import { lessonAssetsType } from '@/lib/handlers/assets/types';
import example from './lessonAssetsResponse.example.json' with { type: 'json' };

export const lessonAssetsResponseSchema = lessonAssetsType.meta({ example });
