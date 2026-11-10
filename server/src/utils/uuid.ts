import { z } from 'zod';
import { NotFoundError } from './errors';

const uuidSchema = z.string().uuid();

export function parseUuid(value: string): string | null {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function getValidUuid(value: string, resource: string): string {
  const id = parseUuid(value);
  if (!id) throw new NotFoundError(`${resource} not found.`);
  return id;
}
