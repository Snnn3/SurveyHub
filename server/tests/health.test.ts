import request from 'supertest';
import app from '../src/app';

describe('GET /api/health (Scaffold Health & Database Connectivity)', () => {
  it('should return 200 and report status ok with database up', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        database: 'up',
      },
    });
  });

  it('should return 404 with standard error envelope for undefined API routes', async () => {
    const res = await request(app).get('/api/nonexistent-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
