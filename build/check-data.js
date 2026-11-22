// Run by the deploy before anything else: tells a non-developer exactly what
// is wrong in public/data.json (JSON syntax or a field of the wrong kind).
import { readFileSync } from 'node:fs';
import { validateData } from '../src/data.js';

const path = new URL('../public/data.json', import.meta.url);
let raw;
try {
  raw = JSON.parse(readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`✗ public/data.json is not valid JSON (often a missing comma or quote):\n  ${err.message}`);
  process.exit(1);
}
const errors = validateData(raw);
if (errors.length) {
  console.error('✗ public/data.json needs a fix:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('✓ public/data.json looks good');
