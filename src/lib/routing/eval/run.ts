/* Прогон точности: npx tsc ... && node run.js  (см. README в отчёте). Не часть сборки Next. */
import * as fs from 'fs';
import * as path from 'path';
import { routeAppeal } from '../engine';
import { orgStore } from '../../store';
import { HOLDOUT } from './holdout';

const ORGS = orgStore.getAll();

function parseBenchmark(file: string) {
  const src = fs.readFileSync(file, 'utf-8');
  const re = /lang: '(RU|KK)',[\s\S]*?appealText: '((?:[^'\\]|\\.)*)',\s*expectedOrgKeyword: '([^']*)'/g;
  const out: Array<{ lang: string; text: string; kw: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ lang: m[1], text: m[2], kw: m[3] });
  return out;
}

async function main() {
  const bench = parseBenchmark(path.join(process.cwd(), 'tests/e2e/api/mcp_surface_and_routing.test.ts'));
  let t1 = 0, t3 = 0;
  const per: Record<string, [number, number]> = { RU: [0, 0], KK: [0, 0] };
  const verbose = process.argv.includes('-v');
  for (const b of bench) {
    const r = await routeAppeal(b.text, ORGS);
    const cands = r.best ? [r.best, ...r.alternatives] : r.alternatives;
    const hit = (c: { orgId: string; fullName: string; lineage: string[] }) => `${c.fullName} ${c.orgId} ${c.lineage.join(' ')}`.toLowerCase().includes(b.kw);
    const ok1 = !!cands[0] && hit(cands[0]) && !r.fallback;
    const ok3 = cands.slice(0, 3).some(hit);
    if (ok1) { t1++; per[b.lang][0]++; }
    if (ok3) t3++;
    per[b.lang][1]++;
    if (verbose || !ok1) console.log(`${ok1 ? 'OK ' : ok3 ? 'T3 ' : 'ERR'} [${b.lang}] want=${b.kw} got=${cands.slice(0, 3).map((c) => c.orgId + ':' + c.score.toFixed(1)).join(' | ')} :: ${b.text.slice(0, 70)}`);
  }
  console.log(`BENCHMARK top1 ${t1}/${bench.length} (${((100 * t1) / bench.length).toFixed(1)}%)  top3 ${t3}/${bench.length} (${((100 * t3) / bench.length).toFixed(1)}%)  RU ${per.RU[0]}/${per.RU[1]} KK ${per.KK[0]}/${per.KK[1]}`);

  let h1 = 0, h3 = 0, hn = 0, rOk = 0, rN = 0;
  for (const c of HOLDOUT) {
    const r = await routeAppeal(c.text, ORGS, { katoCode: c.kato });
    const cands = r.best ? [r.best, ...r.alternatives] : r.alternatives;
    const hit = (x: { orgId: string }) => c.expect.some((p) => x.orgId.startsWith(p));
    const ok1 = !!cands[0] && hit(cands[0]) && !r.fallback;
    const ok3 = cands.slice(0, 3).some(hit);
    hn++;
    if (ok1) h1++;
    if (ok3) h3++;
    if (c.region) { rN++; if (r.region?.prefix === c.region) rOk++; else console.log(`REGION miss want=${c.region} got=${r.region?.prefix} :: ${c.text}`); }
    if (verbose || !ok1) console.log(`${ok1 ? 'OK ' : ok3 ? 'T3 ' : 'ERR'} [${c.lang}] want=${c.expect[0]} got=${cands.slice(0, 3).map((x) => x.orgId + ':' + x.score.toFixed(1)).join(' | ')} :: ${c.text.slice(0, 70)}`);
  }
  console.log(`HOLDOUT   top1 ${h1}/${hn} (${((100 * h1) / hn).toFixed(1)}%)  top3 ${h3}/${hn} (${((100 * h3) / hn).toFixed(1)}%)  region ${rOk}/${rN}`);
  process.exit(0);
}
main();
