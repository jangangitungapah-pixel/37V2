import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const logDirectory = path.resolve(process.cwd(), 'logs', 'firestore-rules');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(logDirectory, `rules-diagnostics-${timestamp}.txt`);

await mkdir(logDirectory, { recursive: true });
await writeFile(
  logPath,
  [
    '37V2 FIRESTORE RULES AGGREGATE DIAGNOSTICS',
    `Started: ${new Date().toISOString()}`,
    `Working directory: ${process.cwd()}`,
    'Mode: FIRESTORE_RULES_AGGREGATE=1',
    '',
  ].join('\n'),
  'utf8',
);
const logStream = createWriteStream(logPath, { flags: 'a' });

console.log(`Firestore Rules diagnostic run started.\nLog: ${logPath}\n`);

const childEnv = {
  ...process.env,
  FIRESTORE_RULES_AGGREGATE: '1',
};

// Reuse the npm CLI that launched this script to avoid Windows npm.cmd quoting issues.
const child = process.env.npm_execpath
  ? spawn(process.execPath, [process.env.npm_execpath, 'run', 'test:rules'], {
      cwd: process.cwd(),
      env: childEnv,
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
    })
  : spawn('npm', ['run', 'test:rules'], {
      cwd: process.cwd(),
      env: childEnv,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    });

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  logStream.write(chunk);
});
child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  logStream.write(chunk);
});

child.on('error', (error) => {
  const message = `\nRunner spawn error: ${error.stack || error.message}\n`;
  process.stderr.write(message);
  logStream.write(message);
  process.exitCode = 1;
});

child.on('close', (code, signal) => {
  const exitCode = Number.isInteger(code) ? code : 1;
  const footer = [
    '',
    `Finished: ${new Date().toISOString()}`,
    `Exit code: ${exitCode}`,
    `Signal: ${signal || 'none'}`,
    `Log file: ${logPath}`,
    '',
  ].join('\n');

  logStream.end(footer, () => {
    console.log(`\nDiagnostic run finished (exit ${exitCode}).`);
    console.log(`Full log saved: ${logPath}`);
    process.exitCode = exitCode;
  });
});
