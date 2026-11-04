// Bundles the JSON files under data/ (Vite / Vitest resolve these imports).
import nouns from '../data/blocks/nouns.json';
import relations from '../data/blocks/relations.json';
import modifiers from '../data/blocks/modifiers.json';
import villages from '../data/villages.json';
import npcs from '../data/npcs.json';
import professions from '../data/tables/profession.json';
import fusion from '../data/tables/fusion.json';
import wishes from '../data/tables/wishes.json';
import compat from '../data/tables/compat.json';
import sentence from '../data/text/sentence.json';
import operatorText from '../data/text/operators.json';
import report from '../data/text/report.json';
import labels from '../data/text/labels.json';
import ui from '../data/text/ui.json';
import { loadGameData, type GameData, type RawGameData } from './sim/data.ts';

export const RAW_GAME_DATA: RawGameData = {
  nouns, relations, modifiers, villages, npcs, professions, fusion, wishes, compat,
  sentence, operatorText, report, labels, ui,
};

export function getGameData(): GameData {
  return loadGameData(RAW_GAME_DATA);
}
