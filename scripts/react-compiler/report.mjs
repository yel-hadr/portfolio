// Which components and hooks the React Compiler skips, and why: runs babel-plugin-react-compiler
// over src/ with the build's options and prints every function it could not compile. Exits 1 if
// there is one, so it can gate a change. Usage: npm run compiler:report
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const compiler = require.resolve('babel-plugin-react-compiler');

const files = [];
const walk = (path) => {
  if (statSync(path).isDirectory()) readdirSync(path).forEach((name) => walk(join(path, name)));
  else if (/\.jsx?$/.test(path)) files.push(path);
};
walk('src');

let compiled = 0;
const failures = [];
for (const file of files) {
  babel.transformSync(readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['jsx'] },
    sourceType: 'module',
    plugins: [
      [
        compiler,
        {
          target: '19',
          logger: {
            logEvent: (_, event) => {
              if (event.kind === 'CompileSuccess') compiled += 1;
              else if (event.kind === 'CompileError') {
                const { detail } = event;
                const reason = detail.reason ?? detail.options?.reason ?? 'unknown';
                const line = event.fnLoc?.start.line ?? detail.loc?.start?.line ?? '';
                failures.push(`${relative('.', file)}:${line}  ${reason}`);
              }
            },
          },
        },
      ],
    ],
  });
}

console.log(`Compiled: ${compiled} components and hooks`);
if (failures.length) {
  console.log(`Skipped: ${failures.length}`);
  failures.forEach((failure) => console.log(`  ${failure}`));
  process.exit(1);
}
console.log('Skipped: none');
