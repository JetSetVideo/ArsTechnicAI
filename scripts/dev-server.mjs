import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = process.env.PORT || '3002';
const host = process.env.HOST || '0.0.0.0';
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function listenerPids() {
  const result = spawnSync('ss', ['-ltnp', `sport = :${port}`], {
    encoding: 'utf8',
  });

  if (result.status !== 0) return [];

  return Array.from(result.stdout.matchAll(/pid=(\d+)/g))
    .map((match) => Number(match[1]))
    .filter((pid, index, pids) => Number.isInteger(pid) && pid !== process.pid && pids.indexOf(pid) === index);
}

async function freePort() {
  const deadline = Date.now() + 5000;
  const reported = new Set();

  while (Date.now() < deadline) {
    let pids = listenerPids();

    if (pids.length === 0) {
      await sleep(350);
      if (listenerPids().length === 0) return true;
      continue;
    }

    const reportKey = pids.join(',');
    if (!reported.has(reportKey)) {
      console.log(`Stopping existing dev server on port ${port}: ${reportKey}`);
      reported.add(reportKey);
    }

    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // The process may already have exited.
      }
    }

    await sleep(500);

    pids = listenerPids();
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // The process may already have exited.
      }
    }

    await sleep(250);
  }

  return listenerPids().length === 0;
}

if (!(await freePort())) {
  console.error(`Port ${port} is still in use by: ${listenerPids().join(', ')}`);
  process.exit(1);
}

const child = spawn(process.execPath, [nextBin, 'dev', '-H', host, '-p', port], {
  stdio: 'inherit',
  env: process.env,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code ?? 0);
});
