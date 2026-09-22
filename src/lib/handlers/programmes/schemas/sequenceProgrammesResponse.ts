import * as z from 'zod/v4';
import example from './sequenceProgrammesResponse.example.json' with { type: 'json' };

export const sequenceProgrammesResponseSchema = z.array(z.string()).meta({
  example,
});
