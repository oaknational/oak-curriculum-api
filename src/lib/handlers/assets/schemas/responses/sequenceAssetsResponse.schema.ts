import { lessonsAssetsType } from '@/lib/handlers/assets/types';
import example from './sequenceAssetsResponse.example.json' with { type: 'json' };

export const sequenceAssetsResponseSchema = lessonsAssetsType.meta({ example });
