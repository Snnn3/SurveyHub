const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tsSeed = path.resolve(__dirname, 'seed.ts');
const compiled = path.resolve(__dirname, '../dist/prisma/seed.js');
const rootCompiled = path.resolve(__dirname, '../../dist/prisma/seed.js');

const target = fs.existsSync(compiled)
  ? compiled
  : fs.existsSync(rootCompiled)
  ? rootCompiled
  : null;

// In production or containers, always run compiled seed directly
if (target && (process.env.NODE_ENV === 'production' || !fs.existsSync(tsSeed) || fs.statSync(target).mtimeMs >= fs.statSync(tsSeed).mtimeMs)) {
  require(target);
} else {
  try {
    execSync(`npx ts-node --transpile-only "${tsSeed}"`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch (err) {
    if (target) {
      require(target);
    } else {
      throw err;
    }
  }
}
