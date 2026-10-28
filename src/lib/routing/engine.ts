/**
 * Детерминированная маршрутизация обращений гражданина по органам.
 * Без внешнего ИИ: нормализация + лёгкая лемматизация RU/KK, BM25-подобное взвешивание
 * (IDF по всей базе органов) по трём полям — курируемые компетенции, названия, FAQ/scope,
 * учёт региона (КАТО/топонимы) и иерархии (профильный орган важнее вышестоящего).
 */
import type { GovOrg } from '../../types';
import { LEXICON } from './lexicon';
import { analyzeQuery, fold, isStop, termMatchesToken, tokenize, QueryToken } from './normalize';
import { detectRegion, findRegionalAkimat, RegionHit } from './geo';

type Src = 'competence' | 'name' | 'scope' | 'faq';

interface IndexedTerm {
  /** Слова термина (свёрнутые). Для многословных — все должны встретиться рядом. */
  words: string[];
  key: string;
  weight: number;
  src: Src;
}

interface IndexedOrg {
  org: GovOrg;
  terms: IndexedTerm[];
  hasCompetence: boolean;
  company: boolean;
  territorial: boolean;
  depth: number;
  local: boolean;
}

interface Index {
  sig: string;
  orgs: IndexedOrg[];
  byId: Map<string, IndexedOrg>;
  df: Map<string, number>;
  avgLen: number;
}

/** Мусорные карточки из тестов/взломов: по названию орган исключается, по scope — только игнорируется scope. */
const JUNK_NAME_RE = /hacked|backdoor|новый подотчетный|<script|drop table/i;
const JUNK_SCOPE_RE = /тестов|аудит проверка полномочий|<script|drop table/i;
const COMPANY_RE = /^(ао|тоо|нао|рго|ргп|ргу|гу|кгу|кгп|нко|нис|нп)(?=[\s"«]|$)/i;
const NAME_STOP = new Set(
  ('министерство республики казахстан республика агентство комитет управление отдел аппарат акима акимат государственн государственное ' +
    'учреждение по и в на при для рк ао тоо нао рг ргу гу департамент служба центр национальн организация район города области област ' +
    'қазақстан республикасы министрлігі комитеті басқармасы бөлімі мемлекеттік мекемесі қаласы облысы ауданы агенттігі аппараты')
    .split(/\s+/)
    .map(fold),
);
const STUB_RE = /сфера (деятельности|ведения)[^:]*:|тестов\w* сфера|полномочия ведомства/gi;

const K1 = 1.2;
const B = 0.25;
const MIN_SCORE = 1.2;

let cache: Index | null = null;
let lineageFn: (o: GovOrg) => string[] = () => [];
const lineageOf = (o: GovOrg) => lineageFn(o);

function parseTerm(raw: string): { words: string[]; weight: number } | null {
  let t = raw.trim();
  let weight = 1;
  if (t.endsWith('^')) { weight = 2; t = t.slice(0, -1).trim(); }
  const words = fold(t).split(/[^a-zа-я0-9\-]+/).filter((w) => w && !isStop(w));
  if (!words.length) return null;
  return { words, weight };
}

function addTerm(map: Map<string, IndexedTerm>, words: string[], weight: number, src: Src) {
  const key = words.join(' ');
  const prev = map.get(key);
  if (!prev || prev.weight < weight) map.set(key, { words, key, weight, src: prev && prev.src === 'competence' ? 'competence' : src });
}

function nameTokens(text: string): string[] {
  return tokenize(text).filter((w) => w.length >= 4 && !NAME_STOP.has(w));
}

function signature(orgs: GovOrg[]): string {
  let h = 0;
  for (const o of orgs) {
    h = (h * 31 + (o.version || 0) + (o.questions?.length || 0) * 7 + (o.scope?.length || 0) + (o.showOnFrontend === false ? 1 : 0) + o.id.length) | 0;
  }
  return `${orgs.length}:${h}`;
}

function buildIndex(orgs: GovOrg[]): Index {
  const sig = signature(orgs);
  if (cache && cache.sig === sig) return cache;

  const byRaw = new Map(orgs.map((o) => [o.id, o]));
  const depthOf = (o: GovOrg): number => {
    let d = 0;
    let cur: GovOrg | undefined = o;
    const seen = new Set<string>();
    while (cur && cur.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      d++;
      cur = byRaw.get(cur.parentId);
    }
    return d;
  };
  const territorialOf = (o: GovOrg): boolean => {
    let cur: GovOrg | undefined = o;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (/^(акимат|аппарат акима|маслихат)/i.test(cur.fullName || cur.name || '') || /oblast$|^akimat/.test(cur.id)) return true;
      cur = cur.parentId ? byRaw.get(cur.parentId) : undefined;
    }
    return false;
  };

  const lineageOf = (o: GovOrg): string[] => {
    const out: string[] = [];
    const seen = new Set<string>([o.id]);
    let cur = o.parentId ? byRaw.get(o.parentId) : undefined;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.id !== 'ap' && cur.id !== 'apr') out.push(cur.fullName || cur.name);
      cur = cur.parentId ? byRaw.get(cur.parentId) : undefined;
    }
    return out;
  };
  lineageFn = lineageOf;
  const indexed: IndexedOrg[] = [];
  const df = new Map<string, number>();

  for (const org of orgs) {
    if (JUNK_NAME_RE.test(`${org.name} ${org.fullName}`) || org.showOnFrontend === false) continue;

    const terms = new Map<string, IndexedTerm>();
    const lex = LEXICON[org.id];
    if (lex) {
      for (const raw of [...lex.ru, ...lex.kk]) {
        const p = parseTerm(raw);
        if (p) addTerm(terms, p.words, p.weight * 1.6, 'competence');
      }
    }
    for (const w of nameTokens(`${org.fullName} ${org.name} ${org.orgNameKk || ''} ${org.shortNameKk || ''}`)) addTerm(terms, [w], 1.5, 'name');
    const scope = String(org.scope || '').replace(STUB_RE, ' ');
    if (!JUNK_SCOPE_RE.test(scope)) for (const w of nameTokens(scope)) addTerm(terms, [w], 0.8, 'scope');
    for (const q of org.questions || []) {
      for (const w of nameTokens(q.topic || '')) addTerm(terms, [w], 1.4, 'faq');
      for (const kw of q.keywords || []) {
        const p = parseTerm(kw);
        if (p) addTerm(terms, p.words, 2, 'faq');
      }
      for (const w of nameTokens(q.description || '')) addTerm(terms, [w], 0.5, 'faq');
    }
    if (!terms.size) continue;

    const list = Array.from(terms.values());
    for (const t of list) df.set(t.key, (df.get(t.key) || 0) + 1);
    indexed.push({
      org,
      terms: list,
      hasCompetence: !!lex,
      company: COMPANY_RE.test(org.fullName || org.name || ''),
      territorial: territorialOf(org),
      depth: depthOf(org),
      local: !!lex?.local,
    });
  }

  const avgLen = indexed.reduce((s, o) => s + o.terms.length, 0) / Math.max(1, indexed.length);
  cache = { sig, orgs: indexed, byId: new Map(indexed.map((o) => [o.org.id, o])), df, avgLen };
  return cache;
}

/** Сколько раз термин встретился в запросе (многословный — все слова рядом) + какие слова. */
function matchTerm(term: IndexedTerm, tokens: QueryToken[]): { tf: number; hits: QueryToken[] } {
  const k = term.words.length;
  if (k === 1) {
    const hits = tokens.filter((t) => termMatchesToken(term.words[0], t));
    return { tf: hits.length, hits };
  }
  const first = tokens.map((t, i) => (termMatchesToken(term.words[0], t) ? i : -1)).filter((i) => i >= 0);
  const hits: QueryToken[] = [];
  let tf = 0;
  for (const i of first) {
    const win = tokens.slice(Math.max(0, i - (k + 2)), i + k + 3);
    const found: QueryToken[] = [tokens[i]];
    let ok = true;
    for (let j = 1; j < k; j++) {
      const t = win.find((x) => !found.includes(x) && termMatchesToken(term.words[j], x));
      if (!t) { ok = false; break; }
      found.push(t);
    }
    if (ok) { tf++; hits.push(...found); }
  }
  return { tf, hits };
}

export interface ScoredOrg {
  orgId: string;
  name: string;
  fullName: string;
  score: number;
  matchedTerms: string[];
  competenceHits: number;
  /** Вышестоящие органы (без АП/АПр), ближайший первым. */
  lineage: string[];
  isRegionalSwap?: boolean;
}

export interface RoutingOutcome {
  best: ScoredOrg | null;
  alternatives: ScoredOrg[];
  region: RegionHit | null;
  regionNote: string;
  confidence: 'high' | 'medium' | 'low';
  matchedTerms: string[];
  basis: string[];
  org: GovOrg | null;
  department?: { id: string | number; name: string } | null;
  fallback: boolean;
}

export async function routeAppeal(
  text: string,
  orgs: GovOrg[],
  opts: { katoCode?: string } = {},
): Promise<RoutingOutcome> {
  const idx = buildIndex(orgs);
  const { tokens } = analyzeQuery(text);
  const region = await detectRegion(tokens, opts.katoCode);
  const N = idx.orgs.length;

  // кэш совпадений термина с запросом на время вызова
  const mcache = new Map<string, { tf: number; hits: QueryToken[] }>();
  const scored: Array<ScoredOrg & { io: IndexedOrg }> = [];

  for (const io of idx.orgs) {
    let score = 0;
    let competenceHits = 0;
    const contrib: Array<{ c: number; hits: QueryToken[]; src: Src }> = [];
    for (const t of io.terms) {
      let m = mcache.get(t.key);
      if (!m) { m = matchTerm(t, tokens); mcache.set(t.key, m); }
      if (!m.tf) continue;
      const d = idx.df.get(t.key) || 1;
      const idf = Math.log(1 + (N - d + 0.5) / (d + 0.5));
      const tfn = ((K1 + 1) * m.tf) / (K1 + m.tf);
      const c = t.weight * idf * tfn;
      score += c;
      contrib.push({ c, hits: m.hits, src: t.src });
      if (t.src === 'competence' || t.src === 'faq') competenceHits++;
    }
    if (score <= 0) continue;

    score /= 1 - B + (B * io.terms.length) / idx.avgLen;

    // профильность: орган с курируемой компетенцией и несколькими разными попаданиями
    if (io.hasCompetence && competenceHits >= 2) score *= 1 + Math.min(0.25, 0.05 * competenceHits);
    // специализация: профильный комитет/подразделение выше министерства при равной релевантности
    if (io.hasCompetence && competenceHits >= 2) score *= 1 + 0.06 * Math.min(io.depth, 3);

    // территориальность
    if (io.territorial) {
      const kato = String(io.org.katoCode || '').slice(0, 2);
      if (region && kato === region.prefix) score *= 1.35;
      else if (region && !io.local) score *= 0.55;
      else if (!region) score *= 0.85;
    }
    // подведомственные юрлица (АО/ТОО/РГП…) — не первичный адресат жалобы
    if (io.company) score *= 0.4;
    // мелкие территориальные подразделения без собственной компетенции — только если названо их место
    if (io.territorial && !io.hasCompetence && io.depth >= 2 && !contrib.some((c) => c.src === 'name')) score *= 0.4;
    // вышестоящие общие органы не должны перебивать профильные
    if (io.org.id === 'ap' || io.org.id === 'apr') score *= 0.8;

    const seenTok = new Set<string>();
    const matched: string[] = [];
    contrib.sort((a, b) => b.c - a.c);
    for (const c of contrib) for (const h of c.hits) if (!seenTok.has(h.raw)) { seenTok.add(h.raw); matched.push(h.orig); }

    scored.push({
      io,
      orgId: io.org.id,
      name: io.org.name,
      fullName: io.org.fullName || io.org.name,
      score,
      matchedTerms: matched.slice(0, 8),
      competenceHits,
      lineage: lineageOf(io.org),
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // региональная подмена акимата-шаблона: «местный вопрос» + назван регион ≠ региону шаблона
  let regionNote = '';
  const top = scored[0];
  if (top && top.io.local && region) {
    const tmplKato = String(top.io.org.katoCode || '').slice(0, 2);
    if (tmplKato !== region.prefix) {
      const ak = await findRegionalAkimat(region.prefix);
      if (ak) {
        top.orgId = ak.id;
        top.name = ak.name;
        top.fullName = ak.fullName;
        top.isRegionalSwap = true;
        top.lineage = [];
        top.io = { ...top.io, org: { ...top.io.org, id: ak.id, name: ak.name, fullName: ak.fullName, departments: [], katoCode: ak.katoCode, jurisdiction: 'regional' } as GovOrg };
      }
    }
  }
  if (region) {
    regionNote =
      region.source === 'katoCode'
        ? `регион по КАТО: ${region.name}`
        : `регион определён по тексту («${region.matched}»): ${region.name}`;
  }

  if (!top || top.score < MIN_SCORE) {
    return { best: null, alternatives: scored.slice(0, 3), region, regionNote, confidence: 'low', matchedTerms: [], basis: [], org: null, fallback: true };
  }

  // иерархия: если выше стоит предок текущего лидера с практически равным баллом — оставляем профильного потомка;
  // если профильный потомок идёт сразу за предком и близок по баллу — поднимаем его
  const ancestorsOf = (o: GovOrg): Set<string> => {
    const s = new Set<string>();
    let cur = o;
    while (cur.parentId && !s.has(cur.parentId)) {
      s.add(cur.parentId);
      const p = idx.byId.get(cur.parentId)?.org;
      if (!p) break;
      cur = p;
    }
    return s;
  };
  let lead = scored[0];
  for (let i = 1; i < Math.min(6, scored.length); i++) {
    const c = scored[i];
    if (c.score >= lead.score * 0.88 && c.io.hasCompetence && c.competenceHits >= 2 && ancestorsOf(c.io.org).has(lead.io.org.id)) {
      lead = c;
    }
  }
  if (lead !== scored[0]) {
    scored.splice(scored.indexOf(lead), 1);
    scored.unshift(lead);
  }

  const second = scored[1];
  const margin = second ? (scored[0].score - second.score) / scored[0].score : 1;
  const confidence: 'high' | 'medium' | 'low' =
    scored[0].score >= 8 && margin >= 0.15 ? 'high' : scored[0].score >= 3.5 ? 'medium' : 'low';

  const best = scored[0];
  const basis: string[] = [];
  const comp = best.io.terms.filter((t) => t.src === 'competence' && (mcache.get(t.key)?.tf || 0) > 0).length;
  const nm = best.io.terms.filter((t) => t.src === 'name' && (mcache.get(t.key)?.tf || 0) > 0).length;
  const fq = best.io.terms.filter((t) => (t.src === 'faq' || t.src === 'scope') && (mcache.get(t.key)?.tf || 0) > 0).length;
  if (comp) basis.push(`компетенции органа: ${comp} совп.`);
  if (nm) basis.push(`наименование органа: ${nm} совп.`);
  if (fq) basis.push(`FAQ/сфера ведения: ${fq} совп.`);
  if (best.io.depth >= 2 && best.io.hasCompetence) basis.push('профильный орган нижнего уровня предпочтён вышестоящему');
  const regionRelevant = best.io.territorial || best.io.local;
  if (region && regionRelevant) basis.push(regionNote);

  // подразделение: пересечение слов запроса с названием/функциями департаментов
  let department: RoutingOutcome['department'] = null;
  const deps = best.io.org.departments || [];
  if (deps.length) {
    let bd = 0;
    for (const d of deps) {
      const nameToks = new Set(nameTokens(d.name));
      const respToks = new Set(nameTokens(String(d.responsible || '')));
      let s = 0;
      for (const t of tokens) {
        if (t.raw.length < 4) continue;
        if (Array.from(nameToks).some((w) => termMatchesToken(w, t))) s += 3;
        else if (Array.from(respToks).some((w) => termMatchesToken(w, t))) s += 1;
      }
      if (s > bd) { bd = s; department = { id: d.id, name: d.name }; }
    }
    if (bd < 4) department = null;
  }

  return {
    best,
    alternatives: scored.slice(1, 3),
    region,
    regionNote: regionRelevant ? regionNote : '',
    confidence,
    matchedTerms: best.matchedTerms,
    basis,
    org: best.io.org,
    department,
    fallback: false,
  };
}
