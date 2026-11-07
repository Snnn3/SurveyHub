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

  it('should return 404 with standard error envelope for undefined API routes (both /api and /api/*)', async () => {
    const resBase = await request(app).get('/api');
    expect(resBase.status).toBe(404);
    expect(resBase.headers['content-type']).toMatch(/json/);
    expect(resBase.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API endpoint does not exist.',
      },
    });

    const resNested = await request(app).get('/api/nonexistent-endpoint');
    expect(resNested.status).toBe(404);
    expect(resNested.headers['content-type']).toMatch(/json/);
    expect(resNested.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API endpoint does not exist.',
      },
    });
  });

  it('should return 400 VALIDATION_ERROR when request contains malformed JSON', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
