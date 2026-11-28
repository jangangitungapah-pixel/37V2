import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const logDirectory = path.resolve(projectRoot, 'logs', 'phase3');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = path.join(logDirectory, `phase3-gates-${timestamp}.txt`);

function readGitValue(args, fallback) {
  try {
    const result = spawnSync('git', args, {
      cwd: projectRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status !== 0) return fallback;
    return result.stdout.trim();
  } catch {
    return fallback;
  }
}

const gitHead = readGitValue(['rev-parse', 'HEAD'], 'unavailable');
const gitStatusOutput = readGitValue(['status', '--short'], 'unavailable');
const gitStatus = gitStatusOutput === '' ? 'clean' : gitStatusOutput;

const stages = [
  ['lint', 'lint'],
  ['vitest', 'test:run'],
  ['firestore-rules', 'test:rules:diagnostics'],
  ['production-build', 'build'],
];

await mkdir(logDirectory, { recursive: true });
await writeFile(
  logPath,
  [
    '37V2 PHASE 3 GATE DIAGNOSTICS',
    `Started: ${new Date().toISOString()}`,
    `Working directory: ${projectRoot}`,
    `Node: ${process.version}`,
    `Platform: ${process.platform} ${process.arch}`,
    `npm user agent: ${process.env.npm_config_user_agent || 'unavailable'}`,
    `Git HEAD: ${gitHead}`,
    `Git status: ${gitStatus}`,
    'Execution: sequential; continue after a failed stage to collect the full gate picture',
    '',
  ].join('\n'),
  'utf8',
);

const logStream = createWriteStream(logPath, { flags: 'a' });

function append(chunk, label, target) {
  const output = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  target.write(output);
  logStream.write(`[${label}] ${output}`);
}

function runNpmScript(script, label) {
  return new Promise((resolve) => {
    const npmCli = process.env.npm_execpath;
    const child = npmCli
      ? spawn(process.execPath, [npmCli, 'run', script], {
          cwd: projectRoot,
          env: process.env,
          stdio: ['inherit', 'pipe', 'pipe'],
          windowsHide: true,
        })
      : spawn('npm', ['run', script], {
          cwd: projectRoot,
          env: process.env,
          stdio: ['inherit', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
          windowsHide: true,
        });

    let settled = false;
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      resolve({
        label,
        script: `npm run ${script}`,
        exitCode: Number.isInteger(code) ? code : 1,
        signal: signal || null,
      });
    };

    child.stdout.on('data', (chunk) => append(chunk, label, process.stdout));
    child.stderr.on('data', (chunk) => append(chunk, label, process.stderr));
    child.on('error', (error) => {
      const message = `\n[${label}] Runner spawn error: ${error.stack || error.message}\n`;
      process.stderr.write(message);
      logStream.write(message);
      finish(1, null);
    });
    child.on('close', finish);
  });
}

console.log(`Phase 3 Gate diagnostics started.\nLog: ${logPath}\n`);
const results = [];

for (const [label, script] of stages) {
  const header = [
    '',
    '============================================================',
    `STAGE: ${label.toUpperCase()}`,
    `COMMAND: npm run ${script}`,
    '============================================================',
    '',
  ].join('\n');
  process.stdout.write(header);
  logStream.write(header);
  const result = await runNpmScript(script, label);
  results.push(result);
  const stageFooter = `\nSTAGE_EXIT_CODE[${label}]=${result.exitCode}\n`;
  process.stdout.write(stageFooter);
  logStream.write(stageFooter);
}

const failed = results.filter((result) => result.exitCode !== 0);
const summary = [
  '',
  '================ PHASE 3 GATE SUMMARY ================',
  ...results.map(
    (result) =>
      `${result.exitCode === 0 ? 'PASS' : 'FAIL'} | ${result.label} | exit=${result.exitCode}`,
  ),
  `Stages passed: ${results.length - failed.length}/${results.length}`,
  `Stages failed: ${failed.length}`,
  `Overall: ${failed.length === 0 ? 'PASS' : 'FAIL'}`,
  `Finished: ${new Date().toISOString()}`,
  `Log file: ${logPath}`,
  '======================================================',
  '',
].join('\n');

process.stdout.write(summary);
logStream.end(summary, () => {
  process.exitCode = failed.length === 0 ? 0 : 1;
});
