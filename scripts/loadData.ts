// Node-side data loader for scripts (reads data/*.json from disk).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DATA_FILES, loadGameData, type GameData, type RawGameData } from '../src/sim/data.ts';

const root = fileURLToPath(new URL('../data/', import.meta.url));

export function loadGameDataFromDisk(): GameData {
  const raw = {} as RawGameData;
  for (const [key, rel] of Object.entries(DATA_FILES)) {
    raw[key as keyof RawGameData] = JSON.parse(readFileSync(root + rel, 'utf8'));
  }
  return loadGameData(raw);
}
