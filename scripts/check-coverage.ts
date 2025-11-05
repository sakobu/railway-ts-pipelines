const LCOV_PATH = 'coverage/lcov.info';

let data = '';
try {
  data = await Bun.file(LCOV_PATH).text();
} catch {
  throw new Error(`Missing ${LCOV_PATH}`);
}

let ok = true;
let currentFile = '';
let lf = 0;
let lh = 0;

for (const line of data.split(/\n/)) {
  if (line.startsWith('SF:')) {
    currentFile = line.slice(3);
  } else if (line.startsWith('LF:')) {
    const n = Number.parseInt(line.slice(3), 10);
    lf = Number.isNaN(n) ? 0 : n;
  } else if (line.startsWith('LH:')) {
    const n = Number.parseInt(line.slice(3), 10);
    lh = Number.isNaN(n) ? 0 : n;
    if (lf !== lh) {
      console.error(`Coverage < 100% for ${currentFile}: LH ${lh} / LF ${lf}`);
      ok = false;
    }
  }
}

if (!ok) {
  throw new Error('Coverage enforcement failed: some files are below 100%');
}

console.log('Coverage enforcement: 100% OK');
