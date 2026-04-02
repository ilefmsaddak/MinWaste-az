import { execSync } from 'node:child_process';

const portArg = process.argv[2];
const port = Number(portArg);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`Usage: node scripts/kill-port.mjs <port>\nInvalid port: ${portArg}`);
  process.exit(2);
}

function tryExec(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const stdout = err?.stdout ? String(err.stdout) : '';
    const stderr = err?.stderr ? String(err.stderr) : '';
    return `${stdout}\n${stderr}`.trim();
  }
}

function getPidsListeningOnPortWindows(targetPort) {
  const out = tryExec(`netstat -ano | findstr :${targetPort}`);
  const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const pids = new Set();
  for (const line of lines) {
    // Typical LISTENING line:
    // TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
    if (!/\bLISTENING\b/i.test(line)) continue;

    const parts = line.split(/\s+/);
    const pid = parts[parts.length - 1];
    if (/^\d+$/.test(pid)) pids.add(Number(pid));
  }
  return [...pids];
}

function getProcessCommandLineWindows(pid) {
  const out = tryExec(`wmic process where processid=${pid} get CommandLine /FORMAT:LIST`);
  const match = out.match(/CommandLine=(.*)/i);
  return match?.[1]?.trim() ?? '';
}

function getParentPidWindows(pid) {
  const out = tryExec(`wmic process where processid=${pid} get ParentProcessId /FORMAT:LIST`);
  const match = out.match(/ParentProcessId=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function looksLikeNestWatch(commandLine) {
  const normalized = commandLine.toLowerCase();
  return (
    normalized.includes('nest.js" start --watch') ||
    normalized.includes('nest.js" start  --watch') ||
    normalized.includes(' nest.js" start --watch') ||
    normalized.includes(' start --watch') && normalized.includes('@nestjs')
  );
}

function findNestWatchAncestorPid(listeningPid, maxDepth = 6) {
  let current = listeningPid;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const cmd = getProcessCommandLineWindows(current);
    if (cmd && shouldKillPid(cmd) && looksLikeNestWatch(cmd)) return current;

    const parent = getParentPidWindows(current);
    if (!parent || parent === current) return null;
    current = parent;
  }
  return null;
}

function shouldKillPid(commandLine) {
  if (!commandLine) return false;

  // Only kill Node processes that look like *this* backend, to avoid nuking unrelated services.
  const normalized = commandLine.toLowerCase();
  return (
    normalized.includes('minwaste-team\\backend') ||
    normalized.includes('minwaste-team-merged\\backend') ||
    normalized.includes('minwaste-team/backend') ||
    normalized.includes('minwaste-team-merged/backend') ||
    normalized.includes('backend\\dist\\main') ||
    normalized.includes('backend\\dist\\src\\main') ||
    normalized.includes('backend/dist/main') ||
    normalized.includes('backend/dist/src/main')
  );
}

if (process.platform !== 'win32') {
  console.warn('kill-port.mjs currently supports Windows only. Skipping.');
  process.exit(0);
}

const pids = getPidsListeningOnPortWindows(port);
if (pids.length === 0) {
  process.exit(0);
}

const killedPids = new Set();

for (const pid of pids) {
  const cmd = getProcessCommandLineWindows(pid);
  if (!shouldKillPid(cmd)) {
    console.warn(`Port ${port} is in use by PID ${pid}, but it does not look like this backend. Skipping.`);
    continue;
  }

  // If the port is held by a child spawned by `nest start --watch`, kill the watch process tree
  // so it doesn't immediately respawn and re-bind the port.
  const watchPid = findNestWatchAncestorPid(pid);
  const targetPid = watchPid ?? pid;
  const killArgs = watchPid ? `/PID ${targetPid} /T /F` : `/PID ${targetPid} /F`;
  const killOut = tryExec(`taskkill ${killArgs}`);
  killedPids.add(targetPid);
  if (killOut) console.log(killOut);
}

// Fallback: if something is still listening on the port, force-kill it.
// In local dev this avoids recurring EADDRINUSE loops.
const remainingPids = getPidsListeningOnPortWindows(port).filter(
  (pid) => !killedPids.has(pid),
);
for (const pid of remainingPids) {
  console.warn(
    `Forcing kill of PID ${pid} still bound to port ${port}.`,
  );
  const killOut = tryExec(`taskkill /PID ${pid} /F`);
  if (killOut) console.log(killOut);
}
