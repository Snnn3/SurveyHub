import { Request, Response } from 'express';
import { getHealthCheck } from '../../src/controllers/health.controller';
import { prisma } from '../../src/utils/prisma';
import { ServiceUnavailableError } from '../../src/utils/errors';

describe('health.controller (unit test)', () => {
  it('calls next with ServiceUnavailableError when database ping fails', async () => {
    const queryRawSpy = jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection failed'));
    const next = jest.fn();
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    await getHealthCheck({} as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorPassed = next.mock.calls[0][0];
    expect(errorPassed).toBeInstanceOf(ServiceUnavailableError);
    expect(errorPassed.statusCode).toBe(503);
    expect(errorPassed.code).toBe('SERVICE_UNAVAILABLE');

    queryRawSpy.mockRestore();
  });
});
