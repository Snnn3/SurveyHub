const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, 'start-server.js');
const script = fs.readFileSync(scriptPath, 'utf8');
const testDatabaseUrls = [
  'postgresql://test:secret@db.example.com:5432/surveyhub_test',
  'postgresql://test:secret@127.0.0.1:5432/surveyhub_test?host=db.example.com',
  'postgresql://test:secret@127.0.0.1:5432/surveyhub_test?hostaddr=203.0.113.7',
  'postgresql://test:secret@127.0.0.1:5432/surveyhub_test?service=remote',
  'postgresql://test:secret@127.0.0.1:5432/surveyhub_prod',
  'mysql://test:secret@localhost:3306/surveyhub_test',
];

for (const testDatabaseUrl of testDatabaseUrls) {
  let resetCalls = 0;
  assert.throws(
    () => vm.runInNewContext(script, {
      __dirname,
      process: { env: { DATABASE_URL_TEST: testDatabaseUrl } },
      console,
      require: (name) => {
        if (name === 'child_process') {
          return { execSync: () => { resetCalls += 1; throw new Error('RESET_COMMAND_RAN'); } };
        }
        if (name === 'dotenv') return { config: () => {} };
        return require(name);
      },
    }),
    { message: 'E2E setup only runs against local DATABASE_URL_TEST for surveyhub_test.' }
  );
  assert.equal(resetCalls, 0, 'unsafe test database must be rejected before the reset command');
}
console.log('E2E database guard passed; unsafe reset command was never called.');
