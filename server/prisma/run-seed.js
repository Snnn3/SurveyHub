const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const compiled = path.resolve(__dirname, '../dist/prisma/seed.js');
const rootCompiled = path.resolve(__dirname, '../../dist/prisma/seed.js');

if (fs.existsSync(compiled)) {
  require(compiled);
} else if (fs.existsSync(rootCompiled)) {
  require(rootCompiled);
} else {
  execSync(`npx ts-node --transpile-only ${path.resolve(__dirname, 'seed.ts')}`, { stdio: 'inherit' });
}
