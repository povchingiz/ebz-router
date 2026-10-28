/**
 * Определение региона обращения: явный katoCode либо топонимы в тексте.
 * Статический справочник областей и крупных городов + динамический газеттир из БД
 * (platform.gov_organizations_master.location_name_ru → kato_code), если БД доступна.
 */
import { analyzeQuery, fold, QueryToken } from './normalize';

export interface Region {
  /** Первые 2 цифры КАТО. */
  prefix: string;
  name: string;
}

export interface RegionHit extends Region {
  source: 'katoCode' | 'text-region' | 'text-locality';
  matched?: string;
}

/** [prefix, название, фразы/корни: если несколько слов — все должны встретиться рядом]. */
const STATIC_REGIONS: Array<[string, string, string[]]> = [
  ['19', 'Алматинская область', ['алматинск област', 'алматы облыс', 'алматинской обл', 'конаев', 'қонаев', 'капшагай', 'қапшағай', 'талгар', 'есик', 'каскелен', 'қаскелең', 'текели']],
  ['75', 'г. Алматы', ['алматы', 'алма-ата', 'алмат']],
  ['71', 'г. Астана', ['астан', 'нур-султан', 'нурсултан']],
  ['79', 'г. Шымкент', ['шымкент']],
  ['10', 'область Абай', ['абай облыс', 'област абай', 'семей', 'семея', 'семее', 'абай област', 'курчатов']],
  ['11', 'Акмолинская область', ['акмолинск', 'ақмола', 'кокшетау', 'көкшетау', 'степногорск', 'щучинск', 'бурабай']],
  ['15', 'Актюбинская область', ['актюбинск', 'ақтөбе', 'актобе', 'хромтау', 'шалкар']],
  ['23', 'Атырауская область', ['атырау', 'кулсары', 'құлсары']],
  ['27', 'Западно-Казахстанская область', ['западно-казахстанск', 'батыс қазақстан', 'уральск', 'орал', 'аксай', 'аксай']],
  ['31', 'Жамбылская область', ['жамбылск', 'жамбыл облыс', 'тараз', 'каратау']],
  ['33', 'область Жетісу', ['жетису', 'жетісу', 'талдыкорган', 'талдықорған', 'жаркент', 'ушарал', 'сарканд']],
  ['35', 'Карагандинская область', ['карагандинск', 'қарағанды', 'караганд', 'темиртау', 'балхаш', 'караганда', 'приозерск', 'шахтинск']],
  ['39', 'Костанайская область', ['костанайск', 'қостанай', 'костанай', 'рудный', 'лисаковск', 'аркалык', 'жетикара']],
  ['43', 'Кызылординская область', ['кызылординск', 'қызылорда', 'кызылорда', 'байконур', 'байқоңыр', 'аральск']],
  ['47', 'Мангистауская область', ['мангистау', 'маңғыстау', 'актау', 'ақтау', 'жанаозен', 'форт-шевченко', 'бейнеу']],
  ['55', 'Павлодарская область', ['павлодар', 'экибастуз', 'екібастұз']],
  ['59', 'Северо-Казахстанская область', ['северо-казахстанск', 'солтүстік қазақстан', 'петропавловск', 'петропавл']],
  ['61', 'Туркестанская область', ['туркестанск', 'түркістан', 'туркестан', 'кентау', 'арыс', 'сарыагаш', 'жетысай', 'ленгер']],
  ['62', 'область Ұлытау', ['улытау', 'ұлытау', 'жезказган', 'жезқазған', 'сатпаев', 'каражал']],
  ['63', 'Восточно-Казахстанская область', ['восточно-казахстанск', 'шығыс қазақстан', 'усть-каменогорск', 'өскемен', 'оскемен', 'риддер', 'зыряновск', 'серебрянск']],
];

interface StaticEntry { prefix: string; name: string; words: string[]; stem: string }

const STATIC_INDEX: StaticEntry[] = [];
for (const [prefix, name, phrases] of STATIC_REGIONS) {
  for (const ph of phrases) {
    const words = fold(ph).split(/[\s]+/).filter(Boolean);
    STATIC_INDEX.push({ prefix, name, words, stem: words.join(' ') });
  }
}

function wordMatches(w: string, tok: QueryToken): boolean {
  return w.length >= 4 ? tok.raw.startsWith(w) : tok.raw === w;
}

function matchStatic(tokens: QueryToken[], skipPrefixes: Set<string>): { region: Region; matched: string } | null {
  let best: { region: Region; matched: string; weight: number } | null = null;
  for (const e of STATIC_INDEX) {
    if (skipPrefixes.has(e.prefix)) continue;
    const k = e.words.length;
    for (let i = 0; i < tokens.length; i++) {
      if (!wordMatches(e.words[0], tokens[i])) continue;
      let ok = true;
      const used = [tokens[i].orig];
      for (let j = 1; j < k; j++) {
        const t = tokens.slice(Math.max(0, i - 2), i + k + 2).find((x) => x !== tokens[i] && wordMatches(e.words[j], x));
        if (!t) { ok = false; break; }
        used.push(t.orig);
      }
      if (ok) {
        // более длинные (специфичные) фразы важнее: «алматинская область» > «алматы»
        const weight = k * 10 + e.words.join('').length;
        if (!best || weight > best.weight) best = { region: { prefix: e.prefix, name: e.name }, matched: used.join(' '), weight };
      }
    }
  }
  return best ? { region: best.region, matched: best.matched } : null;
}

// ---- динамический газеттир из БД ----

interface Gazetteer { map: Map<string, string>; at: number }
let gazetteer: Gazetteer | null = null;
let gazetteerLoading: Promise<void> | null = null;
const GAZ_TTL = 6 * 3600_000;
const KEY_LEN = 6;

const LOC_NOISE = /\b(г\.?\s?а\.?|с\.?\s?о\.?|п\.?\s?а\.?|г\.?|с\.?|п\.?|пос\.?|район|р-н|района|сельский округ|сельского округа|городская администрация|город|область|обл\.?|аул|село|поселок)\b/gi;

function locKey(name: string): string | null {
  const cleaned = fold(name.replace(LOC_NOISE, ' ')).replace(/[^a-zа-я\- ]+/g, ' ').trim();
  const first = cleaned.split(/\s+/).filter((w) => w.length >= KEY_LEN)[0];
  if (!first) return null;
  return first.slice(0, KEY_LEN);
}

async function loadGazetteer(): Promise<void> {
  try {
    const { pool } = await import('../db');
    const { rows } = await pool.query(
      `SELECT location_name_ru AS n, substr(kato_code,1,2) AS p, count(*)::int AS c
       FROM platform.gov_organizations_master
       WHERE deleted = FALSE AND location_name_ru IS NOT NULL AND kato_code IS NOT NULL
       GROUP BY 1, 2`,
    );
    const seen = new Map<string, Set<string>>();
    for (const r of rows) {
      const key = locKey(String(r.n));
      if (!key || !r.p) continue;
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key)!.add(r.p);
    }
    const map = new Map<string, string>();
    seen.forEach((set, k) => { if (set.size === 1) map.set(k, Array.from(set)[0]); });
    gazetteer = { map, at: Date.now() };
  } catch {
    gazetteer = { map: new Map(), at: Date.now() - GAZ_TTL + 60_000 }; // не долбим БД чаще раза в минуту
  }
}

async function ensureGazetteer(): Promise<void> {
  if (gazetteer && Date.now() - gazetteer.at < GAZ_TTL) return;
  if (!gazetteerLoading) gazetteerLoading = loadGazetteer().finally(() => { gazetteerLoading = null; });
  await Promise.race([gazetteerLoading, new Promise<void>((r) => setTimeout(r, 1500))]);
}

const PREFIX_NAMES = new Map(STATIC_REGIONS.map(([p, n]) => [p, n] as const));

/** Регион по КАТО-коду заявителя либо по топонимам обращения. Текст приоритетнее katoCode: «проблема там, где указано». */
export async function detectRegion(tokens: QueryToken[], katoCode?: string): Promise<RegionHit | null> {
  const st = matchStatic(tokens, new Set());
  if (st) return { ...st.region, source: 'text-region', matched: st.matched };

  await ensureGazetteer();
  if (gazetteer && gazetteer.map.size) {
    for (const t of tokens) {
      if (t.raw.length < KEY_LEN) continue;
      const p = gazetteer.map.get(t.raw.slice(0, KEY_LEN));
      if (p && PREFIX_NAMES.has(p)) return { prefix: p, name: PREFIX_NAMES.get(p)!, source: 'text-locality', matched: t.orig };
    }
  }

  const kato = String(katoCode || '').replace(/\D/g, '');
  if (kato.length >= 2) {
    const p = kato.slice(0, 2);
    if (PREFIX_NAMES.has(p)) return { prefix: p, name: PREFIX_NAMES.get(p)!, source: 'katoCode' };
  }
  return null;
}

// ---- акимат региона из БД (когда в хранилище нет своего) ----

export interface RegionalAkimat { id: string; name: string; fullName: string; katoCode: string }
const akimatCache = new Map<string, { v: RegionalAkimat | null; at: number }>();

export async function findRegionalAkimat(prefix: string): Promise<RegionalAkimat | null> {
  const hit = akimatCache.get(prefix);
  if (hit && Date.now() - hit.at < GAZ_TTL) return hit.v;
  let v: RegionalAkimat | null = null;
  try {
    const { pool } = await import('../db');
    const { rows } = await pool.query(
      `SELECT org_id, short_name_ru, org_name_ru, kato_code
       FROM platform.gov_organizations_master
       WHERE deleted = FALSE AND org_type_ru = 'Акимат области/города респ значения'
         AND kato_code LIKE $1 AND org_name_ru ILIKE '%Аппарат акима%'
       ORDER BY length(kato_code) DESC, org_id ASC LIMIT 1`,
      [`${prefix}%`],
    );
    if (rows[0]) {
      v = {
        id: `org-${rows[0].org_id}`,
        name: rows[0].short_name_ru || rows[0].org_name_ru,
        fullName: String(rows[0].org_name_ru).replace(/^(коммунальное\s+)?государственное учреждение\s*/i, '').replace(/["«»]/g, ''),
        katoCode: rows[0].kato_code,
      };
    }
  } catch {
    v = null;
  }
  akimatCache.set(prefix, { v, at: Date.now() });
  return v;
}
