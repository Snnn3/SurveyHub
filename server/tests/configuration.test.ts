import { getDemoUserPassword } from '../prisma/seed-users';

jest.mock('dotenv', () => ({ config: jest.fn() }));

const configKeys = ['NODE_ENV', 'PORT', 'JWT_SECRET', 'DATABASE_URL'] as const;

function loadEnvironment(overrides: Partial<Record<(typeof configKeys)[number], string>>) {
  const previous = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));
  for (const key of configKeys) {
    delete process.env[key];
    if (overrides[key] !== undefined) process.env[key] = overrides[key];
  }

  try {
    let loaded: typeof import('../src/config/environment') | undefined;
    jest.isolateModules(() => {
      loaded = require('../src/config/environment') as typeof import('../src/config/environment');
    });
    return loaded!.env;
  } finally {
    for (const key of configKeys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('production configuration', () => {
  const validSecret = 'a'.repeat(32);
  const validDatabaseUrl = 'postgresql://surveyhub:secure-postgres-word-pass@db:5432/surveyhub?schema=public';

  it('rejects missing or default JWT secrets', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'production', DATABASE_URL: validDatabaseUrl })).toThrow(
      /JWT_SECRET/
    );
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'production',
        JWT_SECRET: 'replace-with-a-long-random-value',
        DATABASE_URL: validDatabaseUrl,
      })
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      loadEnvironment({ NODE_ENV: 'production', JWT_SECRET: 'short', DATABASE_URL: validDatabaseUrl })
    ).toThrow(/JWT_SECRET/);
  });

  it('rejects missing and default database URLs without exposing credentials', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'production', JWT_SECRET: validSecret })).toThrow(
      /DATABASE_URL/
    );
    const invalidDatabaseUrls = [
      'postgresql://postgres:postgres@localhost:5432/surveyhub?schema=public',
      'postgresql://surveyhub:postgres@db:5432/surveyhub',
      'postgresql://surveyhub:%20postgres%20@db:5432/surveyhub',
      'postgresql:/surveyhub',
      'postgresql://surveyhub:replace-with-a-local-database-password@db:5432/surveyhub',
      'postgresql://surveyhub@db:5432/surveyhub',
      'postgresql://surveyhub:@db:5432/surveyhub',
      'postgresql://surveyhub:%20@db:5432/surveyhub',
      'postgresql://:secure-postgres-word-pass@db:5432/surveyhub',
      'postgresql://surveyhub:secure-postgres-word-pass@db:5432///',
      'mysql://surveyhub:secure-postgres-word-pass@db:3306/surveyhub',
    ];
    for (const url of invalidDatabaseUrls) {
      expect(() =>
        loadEnvironment({
          NODE_ENV: 'production',
          JWT_SECRET: validSecret,
          DATABASE_URL: url,
        })
      ).toThrow(/DATABASE_URL/);
    }
  });

  it('uses the configured Cloud Run port and accepts non-default production settings', () => {
    const env = loadEnvironment({
      NODE_ENV: 'production',
      PORT: '8080',
      JWT_SECRET: validSecret,
      DATABASE_URL: validDatabaseUrl,
    });
    expect(env.PORT).toBe(8080);
    expect(env.DATABASE_URL).toBe(validDatabaseUrl);
  });

  it('accepts and trims a Cloud SQL Unix socket URL', () => {
    const cloudSqlUrl =
      'postgresql://surveyhub:secure-postgres-word-pass@localhost/surveyhub?host=/cloudsql/my-project:asia-southeast1:surveyhub-db';
    const env = loadEnvironment({
      NODE_ENV: 'production',
      JWT_SECRET: validSecret,
      DATABASE_URL: ` ${cloudSqlUrl} `,
    });

    expect(env.DATABASE_URL).toBe(cloudSqlUrl);
  });

  it('rejects hostless Cloud SQL socket URLs', () => {
    expect(() =>
      loadEnvironment({
        NODE_ENV: 'production',
        JWT_SECRET: validSecret,
        DATABASE_URL:
          'postgresql://surveyhub:secure-postgres-word-pass@/surveyhub?host=/cloudsql/my-project:asia-southeast1:surveyhub-db',
      })
    ).toThrow(/DATABASE_URL/);
  });
});

describe('seed password configuration', () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, DEMO_USER_PASSWORD: process.env.DEMO_USER_PASSWORD };

  afterEach(() => {
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.DEMO_USER_PASSWORD === undefined) delete process.env.DEMO_USER_PASSWORD;
    else process.env.DEMO_USER_PASSWORD = previous.DEMO_USER_PASSWORD;
  });

  it('requires an operator supplied password and rejects the example placeholder', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEMO_USER_PASSWORD;
    expect(() => getDemoUserPassword()).toThrow(/DEMO_USER_PASSWORD/);
    process.env.DEMO_USER_PASSWORD = 'replace-with-a-local-demo-password';
    expect(() => getDemoUserPassword()).toThrow(/DEMO_USER_PASSWORD/);
  });

  it('rejects the fixed test password and weak values for production seeds', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_USER_PASSWORD = 'Password123!';
    expect(() => getDemoUserPassword()).toThrow(/DEMO_USER_PASSWORD/);
    process.env.DEMO_USER_PASSWORD = 'short';
    expect(() => getDemoUserPassword()).toThrow(/DEMO_USER_PASSWORD/);
  });

  it('accepts explicit synthetic test credentials outside production', () => {
    process.env.NODE_ENV = 'test';
    process.env.DEMO_USER_PASSWORD = 'Password123!';
    expect(getDemoUserPassword()).toBe('Password123!');
    process.env.NODE_ENV = 'production';
    process.env.DEMO_USER_PASSWORD = 'operator-chosen-local-seed-password';
    expect(getDemoUserPassword()).toBe('operator-chosen-local-seed-password');
  });
});
