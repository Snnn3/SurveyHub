import { z } from 'zod';

export const DATABASE_INT_MIN = -2_147_483_648;
export const DATABASE_INT_MAX = 2_147_483_647;

export const databaseIntegerSchema = z.number().int().min(DATABASE_INT_MIN).max(DATABASE_INT_MAX);

export function isDatabaseInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= DATABASE_INT_MIN && value <= DATABASE_INT_MAX;
}
