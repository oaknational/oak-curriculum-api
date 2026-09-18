import { lessonsAssetsType } from '@/lib/handlers/assets/types';
import example from './subjectAssetsResponse.example.json' with { type: 'json' };

export const subjectAssetsResponseSchema = lessonsAssetsType.meta({ example });
