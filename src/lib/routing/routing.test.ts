// @ts-ignore — vitest не в devDependencies проекта (ставится через npx)
import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { routeAppeal } from './engine';
import { orgStore } from '../store';
import { stem, fold } from './normalize';
import { HOLDOUT } from './eval/holdout';

const ORGS = orgStore.getAll();

function parseBenchmark() {
  const src = fs.readFileSync(path.join(process.cwd(), 'tests/e2e/api/mcp_surface_and_routing.test.ts'), 'utf-8');
  const re = /lang: '(RU|KK)',[\s\S]*?appealText: '((?:[^'\\]|\\.)*)',\s*expectedOrgKeyword: '([^']*)'/g;
  const out: Array<{ lang: string; text: string; kw: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ lang: m[1], text: m[2], kw: m[3] });
  return out;
}

describe('routing: нормализация', () => {
  it('сворачивает казахские буквы и режет окончания', () => {
    expect(fold('Қарағанды әкімдігі')).toBe('караганди акимдиги');
    expect(stem(fold('мектептердегі'))).toBe('мектеп');
    expect(stem(fold('поликлиниками')).startsWith('поликлин')).toBe(true);
  });
});

describe('routing: точность', () => {
  it('бенчмарк (30 обращений): top-1 >= 70%, top-3 >= 90%', async () => {
    const bench = parseBenchmark();
    expect(bench.length).toBe(30);
    let t1 = 0, t3 = 0;
    for (const b of bench) {
      const r = await routeAppeal(b.text, ORGS);
      const cands = r.best ? [r.best, ...r.alternatives] : r.alternatives;
      const hit = (c: { orgId: string; fullName: string; lineage: string[] }) =>
        `${c.fullName} ${c.orgId} ${c.lineage.join(' ')}`.toLowerCase().includes(b.kw);
      if (cands[0] && hit(cands[0]) && !r.fallback) t1++;
      if (cands.slice(0, 3).some(hit)) t3++;
    }
    expect(t1 / 30).toBeGreaterThanOrEqual(0.7);
    expect(t3 / 30).toBeGreaterThanOrEqual(0.9);
  });

  it('отложенная выборка (>=30 новых RU/KK): top-1 >= 70%, top-3 >= 90%', async () => {
    expect(HOLDOUT.length).toBeGreaterThanOrEqual(30);
    let t1 = 0, t3 = 0;
    for (const c of HOLDOUT) {
      const r = await routeAppeal(c.text, ORGS, { katoCode: c.kato });
      const cands = r.best ? [r.best, ...r.alternatives] : r.alternatives;
      const hit = (x: { orgId: string }) => c.expect.some((p) => x.orgId.startsWith(p));
      if (cands[0] && hit(cands[0]) && !r.fallback) t1++;
      if (cands.slice(0, 3).some(hit)) t3++;
    }
    expect(t1 / HOLDOUT.length).toBeGreaterThanOrEqual(0.7);
    expect(t3 / HOLDOUT.length).toBeGreaterThanOrEqual(0.9);
  });
});

describe('routing: свойства', () => {
  it('детерминирован', async () => {
    const t = 'Врач в поликлинике отказал в выдаче бесплатных лекарств.';
    const a = await routeAppeal(t, ORGS);
    const b = await routeAppeal(t, ORGS);
    expect(JSON.stringify(a.best)).toBe(JSON.stringify(b.best));
  });

  it('объяснимость: совпавшие термины и основание', async () => {
    const r = await routeAppeal('Не выплачивают заработную плату уже четыре месяца, работодатель игнорирует.', ORGS);
    expect(r.best).not.toBeNull();
    expect(r.matchedTerms.length).toBeGreaterThan(0);
    expect(r.basis.length).toBeGreaterThan(0);
  });

  it('нет совпадений → fallback без падения', async () => {
    const r = await routeAppeal('qwerty asdf zxcv', ORGS);
    expect(r.fallback).toBe(true);
    expect(r.best).toBeNull();
  });

  it('katoCode задаёт регион для местных вопросов', async () => {
    const r = await routeAppeal('Во дворе не убирают мусор.', ORGS, { katoCode: '551010000' });
    expect(r.region?.prefix).toBe('55');
    expect(r.best?.orgId.startsWith('org-') || r.best?.orgId.startsWith('akimat')).toBe(true);
  });

  it('город в тексте определяет регион', async () => {
    const r = await routeAppeal('В Актау во дворе не убирают мусор.', ORGS);
    expect(r.region?.prefix).toBe('47');
  });

  it('мусорные карточки (Hacked Backdoor Org, тестовые) не попадают в выдачу', async () => {
    const r = await routeAppeal('Hacked Backdoor Org подотчетный отдел Минэнерго электроэнергия', ORGS);
    for (const c of [r.best, ...r.alternatives]) if (c) expect(/hacked|backdoor|новый подотчетный/i.test(c.fullName)).toBe(false);
  });

  afterAll(async () => {
    try { const { pool } = await import('../db'); await pool.end(); } catch { /* БД могла не подключаться */ }
  });
});
