// Rebuild the downloadable connector from the maintained MIT-licensed fork.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const source = resolve(process.argv[2] || '../grok-bot-skill/scripts/grokbot.py');
const destination = resolve('public/connect-grok.mjs');
const cli = readFileSync(source, 'utf8');
const roundModule = readFileSync(resolve('scripts/grok-round.mjs'), 'utf8');
const lines = readFileSync(destination, 'utf8').split('\n');
const index = lines.findIndex(line => line.trimStart().startsWith('writeFileSync(script, '));
if (index < 0 || !cli.includes('def cmd_setup_demo(')) throw new Error('Expected the native-group fork and existing connector bundle.');
lines[index] = `  writeFileSync(script, ${JSON.stringify(cli)}, { mode: 0o600 });`;
const roundIndex = lines.findIndex(line => line.startsWith('const ROUND_MODULE_SOURCE = '));
if (roundIndex < 0 || !roundModule.includes('createRoundController')) throw new Error('Expected the round controller and connector bundle marker.');
lines[roundIndex] = `const ROUND_MODULE_SOURCE = ${JSON.stringify(roundModule)};`;
writeFileSync(destination, lines.join('\n'));
console.log('Bundled Kazybekkh/grok-bot-skill; SHA-256 ' + createHash('sha256').update(cli).digest('hex'));
