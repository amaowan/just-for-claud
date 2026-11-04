import { describe, expect, it } from 'vitest';
import { getGameData } from '../src/gameData.ts';
import { tellByPlayer } from '../src/sim/propagation.ts';
import { updateSediment } from '../src/sim/sediment.ts';
import type { IdeaShape } from '../src/sim/types.ts';
import { addBelief, createSim, registerIdea, removeBelief, villageCore, type Sim } from '../src/sim/world.ts';

const data = getGameData();
const coast = data.residents.coast;

function plant(sim: Sim, shape: IdeaShape, count: number, village = 'coast') {
  const idea = registerIdea(sim, shape, null, [], 0);
  for (const id of data.residents[village].slice(0, count)) addBelief(sim, id, idea, 'test');
  return idea;
}

/** Jump forward month by month, running the sediment check each time. */
function runMonths(sim: Sim, months: number) {
  for (let i = 0; i < months; i++) {
    sim.world.day += 30;
    for (const id of data.npcIds) for (const b of Object.values(sim.world.beliefs[id])) { b.lastMentionDay = sim.world.day; b.lastEchoDay = sim.world.day; }
    updateSediment(sim);
  }
}

const ritual: IdeaShape = { subject: 'mountainGod', relation: 'like', object: 'song', modifiers: [], form: 'ritual', season: 'spring' };
const lives: IdeaShape = { subject: 'giant', relation: 'liveIn', object: 'mountain', modifiers: [], form: 'statement' };

describe('sedimentation stages', () => {
  it('rumor at 3 believers, common knowledge at 30%', () => {
    const sim = createSim(data, 1);
    const idea = plant(sim, lives, 2);
    updateSediment(sim);
    expect(villageCore(sim, 'coast', idea.core).everRumorDay).toBeUndefined();
    addBelief(sim, coast[2], idea, 'test');
    updateSediment(sim);
    const vc = villageCore(sim, 'coast', idea.core);
    expect(vc.everRumorDay).toBeDefined();
    expect(vc.everCommonDay).toBeDefined(); // 3/10 = 30%
  });

  it('a ritual held by 50%+ for 5 years becomes a custom, then a festival 15 years later', () => {
    const sim = createSim(data, 2);
    const idea = plant(sim, ritual, 6);
    // The timer starts at the first monthly check (day 30), so the custom appears at month 61.
    runMonths(sim, 60);
    expect(villageCore(sim, 'coast', idea.core).customDay).toBeUndefined();
    runMonths(sim, 1);
    expect(villageCore(sim, 'coast', idea.core).customDay).toBeDefined();
    runMonths(sim, 15 * 12);
    expect(villageCore(sim, 'coast', idea.core).festivalDay).toBeDefined();
  });

  it('statements never become customs, and dipping below 50% resets the timer', () => {
    const sim = createSim(data, 3);
    const plain = plant(sim, lives, 6);
    runMonths(sim, 70);
    expect(villageCore(sim, 'coast', plain.core).customDay).toBeUndefined();

    const r = plant(sim, ritual, 6);
    runMonths(sim, 40);
    removeBelief(sim, coast[0], r.core);
    removeBelief(sim, coast[1], r.core);
    runMonths(sim, 1); // 40% at a check: reset
    addBelief(sim, coast[0], r, 'test');
    addBelief(sim, coast[1], r, 'test');
    runMonths(sim, 30);
    expect(villageCore(sim, 'coast', r.core).customDay).toBeUndefined();
  });

  it('a much-mentioned common idea about a place becomes its one name', () => {
    const sim = createSim(data, 4);
    const idea = plant(sim, lives, 4);
    villageCore(sim, 'coast', idea.core).mentions = 999;
    runMonths(sim, 1);
    expect(sim.world.placeNames.coast.mountain).toBeUndefined();
    villageCore(sim, 'coast', idea.core).mentions = 1000;
    runMonths(sim, 1);
    expect(sim.world.placeNames.coast.mountain).toMatchObject({ name: '巨人山', renames: 0 });
  });

  it('a rival name takes over only with more than 3x the mentions', () => {
    const sim = createSim(data, 4);
    const giant = plant(sim, lives, 4);
    villageCore(sim, 'coast', giant.core).mentions = 1000;
    runMonths(sim, 1);
    const fox = registerIdea(sim, { subject: 'fox', relation: 'liveIn', object: 'mountain', modifiers: [], form: 'statement' }, null, [], 0);
    for (const id of coast.slice(4, 8)) addBelief(sim, id, fox, 'test');
    villageCore(sim, 'coast', fox.core).mentions = 3000; // exactly 3x: not enough
    runMonths(sim, 1);
    expect(sim.world.placeNames.coast.mountain.name).toBe('巨人山');
    villageCore(sim, 'coast', fox.core).mentions = 3001;
    runMonths(sim, 1);
    expect(sim.world.placeNames.coast.mountain).toMatchObject({ name: '狐狸山', renames: 1 });
    const events = sim.world.events.filter((e) => e.type === 'placeName');
    expect(events.map((e) => (e.type === 'placeName' ? [e.name, e.previous] : []))).toEqual([['巨人山', undefined], ['狐狸山', '巨人山']]);
  });

  it('a deified idea at 60% in both villages gives birth to a god, once', () => {
    const sim = createSim(data, 5);
    const god: IdeaShape = { subject: 'mountainGod', relation: 'guard', object: 'stone', modifiers: [], form: 'statement' };
    const idea = plant(sim, god, 6, 'coast');
    runMonths(sim, 1);
    expect(sim.world.deities.mountainGod).toBeUndefined();
    for (const id of data.residents.mine.slice(0, 6)) addBelief(sim, id, idea, 'test');
    runMonths(sim, 2);
    expect(sim.world.deities.mountainGod).toBeDefined();
    // Another core about the same god does not give birth again.
    const other = plant(sim, { subject: 'mountainGod', relation: 'liveIn', object: 'mountain', modifiers: [], form: 'statement' }, 7, 'coast');
    for (const id of data.residents.mine.slice(0, 7)) addBelief(sim, id, other, 'test');
    runMonths(sim, 2);
    expect(sim.world.events.filter((e) => e.type === 'deity')).toHaveLength(1);
  });
});

describe('decay', () => {
  it('versions nobody repeats back are forgotten; echoed ones are kept', () => {
    let forgotten = 0;
    for (let seed = 0; seed < 10; seed++) {
      const sim = createSim(data, seed);
      const idea = plant(sim, lives, 10);
      sim.world.day = 210;
      for (const id of coast.slice(0, 5)) sim.world.beliefs[id][idea.core].lastEchoDay = 200; // recently echoed
      updateSediment(sim); // day 210 is a check day; the rest were last echoed on day 0 (> 180 days ago)
      for (const id of coast.slice(0, 5)) expect(sim.world.beliefs[id][idea.core]).toBeDefined();
      forgotten += coast.slice(5).filter((id) => !sim.world.beliefs[id][idea.core]).length;
    }
    expect(forgotten).toBeGreaterThan(0); // ~25% of 50
    expect(forgotten).toBeLessThan(25);
  });

  it('a lone believer of an offshoot forgets it within a couple of years', () => {
    const sim = createSim(data, 3);
    const idea = plant(sim, lives, 1);
    for (let m = 1; m <= 24; m++) { sim.world.day = m * 30; updateSediment(sim); }
    expect(sim.world.beliefs[coast[0]][idea.core]).toBeUndefined();
  });

  it('customs are practised and not forgotten', () => {
    const sim = createSim(data, 3);
    const idea = plant(sim, ritual, 6);
    villageCore(sim, 'coast', idea.core).customDay = 0;
    for (let m = 1; m <= 24; m++) { sim.world.day = m * 30; updateSediment(sim); }
    expect(villageCore(sim, 'coast', idea.core).believers).toBe(6);
  });

  it('hearing the exact same version from someone else counts as an echo', () => {
    const sim = createSim(data, 3);
    const idea = plant(sim, lives, 1);
    sim.world.day = 300;
    tellByPlayer(sim, coast[0], lives);
    expect(sim.world.beliefs[coast[0]][idea.core].lastEchoDay).toBe(300);
  });
});
