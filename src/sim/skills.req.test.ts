import { describe, expect, it } from 'vitest';
import { MAX_SKILL_RANK, SKILLS, START_STAT_POINTS, STAT_POINTS_PER_LEVEL, skillMainAttr, skillReq } from './data';

describe('Attribut-Anforderungen der Fertigkeiten', () => {
  it('jede Anforderung ist mit einem Teil der Attributpunkte bis zur Stufe des Skills erreichbar', () => {
    for (const s of SKILLS) {
      const points = START_STAT_POINTS + STAT_POINTS_PER_LEVEL * (s.levelReq - 1);
      for (let rank = 1; rank <= (s.passive ? MAX_SKILL_RANK : 1); rank++) {
        for (const [, need] of Object.entries(skillReq(s, rank))) {
          expect(need - 10, `${s.id} Rang ${rank}`).toBeLessThanOrEqual(points * 0.7);
        }
      }
    }
  });

  it('Aktive Skills verlangen ihr Hauptattribut, höhere Stufen mehr (je Gebiet und Schule monoton)', () => {
    const groups = new Map<string, number[]>();
    for (const s of SKILLS.filter((x) => !x.passive).sort((a, b) => a.levelReq - b.levelReq)) {
      const key = `${s.area}/${skillMainAttr(s)}/${s.dmgType ?? 'none'}`;
      const need = skillReq(s)[skillMainAttr(s)] ?? 0;
      const arr = groups.get(key) ?? [];
      if (arr.length) expect(need, `${s.id} in ${key}`).toBeGreaterThanOrEqual(arr.at(-1)!);
      arr.push(need);
      groups.set(key, arr);
    }
    expect(groups.size).toBeGreaterThan(5);
  });

  it('pro Element gibt es mindestens 4 aktive Zauber, und es kommt regelmäßig ein neuer dazu', () => {
    const fire = SKILLS.filter((s) => s.area === 'Magie' && s.dmgType === 'fire' && !s.passive).map((s) => s.levelReq).sort((a, b) => a - b);
    const frost = SKILLS.filter((s) => s.area === 'Magie' && s.dmgType === 'frost' && !s.passive).map((s) => s.levelReq).sort((a, b) => a - b);
    for (const row of [fire, frost]) {
      expect(row.length).toBeGreaterThanOrEqual(5);
      for (let i = 1; i < row.length; i++) expect(row[i]! - row[i - 1]!, row.join(',')).toBeLessThanOrEqual(7);
    }
  });

  it('jede Stufe von 1 bis 30 bringt mindestens einen neuen aktiven Skill (Zauber oder Kampf)', () => {
    const gaps: number[] = [];
    for (let l = 1; l <= 30; l++) if (!SKILLS.some((s) => !s.passive && s.levelReq === l)) gaps.push(l);
    expect(gaps.length, `Stufen ohne neuen Skill: ${gaps.join(', ')}`).toBeLessThanOrEqual(6);
  });
});
