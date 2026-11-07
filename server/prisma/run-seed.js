const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tsSeed = path.resolve(__dirname, 'seed.ts');
const compiled = path.resolve(__dirname, '../dist/prisma/seed.js');
const rootCompiled = path.resolve(__dirname, '../../dist/prisma/seed.js');

function isUsable(targetPath) {
  if (!fs.existsSync(targetPath)) return false;
  if (fs.existsSync(tsSeed)) {
    return fs.statSync(targetPath).mtimeMs >= fs.statSync(tsSeed).mtimeMs;
  }
  return true;
}

if (isUsable(compiled)) {
  require(compiled);
} else if (isUsable(rootCompiled)) {
  require(rootCompiled);
} else {
  execSync(`npx ts-node --transpile-only "${tsSeed}"`, {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });
}

