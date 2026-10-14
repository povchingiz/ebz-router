import asyncio
import asyncpg
import re

PATTERNS = [
    r'^(?:Республиканское\s+)?государственное\s+(?:казенное\s+)?(?:коммунальное\s+)?(?:учреждение|предприятие)(?:\s+на\s+праве\s+(?:хозяйственного\s+ведения|оперативного\s+управления))?',
    r'^(?:Коммунальное\s+)?государственное\s+(?:казенное\s+)?(?:коммунальное\s+)?(?:учреждение|предприятие)(?:\s+на\s+праве\s+(?:хозяйственного\s+ведения|оперативного\s+управления))?',
    r'^(?:Некоммерческое\s+)?акционерное\s+общество',
    r'^(?:Государственное\s+коммунальное\s+казенное\s+предприятие)',
    r'^(?:РГУ|КГУ|ГУ|ГККП|КГКП|КГП на ПХВ|РГП на ПХВ|РГП|КГП|НАО|АО|ТОО)',
]

KNOWN_ABBREVIATIONS = {
    77: 'АП',
    30400: 'Правительство РК',
    17875: 'АРРФР',
    17850: 'АДГС',
    17856: 'Верховный Суд РК',
    17859: 'Генпрокуратура РК',
    17874: 'КНБ РК',
    17868: 'Минкультуры РК',
    17863: 'Минздрав РК',
    17865: 'Минпросвещения РК',
    17864: 'МНВО РК',
    17873: 'Минэнерго РК',
    17870: 'Минэкологии РК',
    17871: 'Минторговли РК',
    17872: 'Минтранспорта РК',
    17866: 'Минтруда РК',
    17867: 'Минюст РК',
    17869: 'МВД РК',
    17861: 'МИД РК',
    17862: 'МЧС РК',
    17860: 'Минобороны РК',
}

def clean_org_name(org_id: int, full_name: str, current_short: str = None) -> str:
    if org_id in KNOWN_ABBREVIATIONS:
        return KNOWN_ABBREVIATIONS[org_id]

    if current_short and re.match(r'^[А-ЯЁA-Z]{2,6}$', current_short):
        return current_short

    s = full_name.strip()

    # Снимаем формы собственности
    for p in PATTERNS:
        s = re.sub(p, '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'^[\"«“\s]+|[\"»”\s]+$', '', s).strip()
    for p in PATTERNS:
        s = re.sub(p, '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'^[\"«“\s]+|[\"»”\s]+$', '', s).strip()

    # Упрощаем аппараты акиматов и маслихатов
    s = re.sub(r'^Аппарат\s+акима\s+', 'Акимат ', s, flags=re.IGNORECASE)
    s = re.sub(r'^Аппарат\s+маслихата\s+', 'Маслихат ', s, flags=re.IGNORECASE)
    s = re.sub(r'^Аппарат\s+([^\s]+)\s+районного\s+маслихата', r'Маслихат \1 р-на', s, flags=re.IGNORECASE)
    s = re.sub(r'^Аппарат\s+([^\s]+)\s+городского\s+маслихата', r'Маслихат г. \1', s, flags=re.IGNORECASE)
    s = re.sub(r'^Аппарат\s+([^\s]+)\s+областного\s+маслихата', r'Маслихат \1 обл.', s, flags=re.IGNORECASE)

    # Сокращения
    s = re.sub(r'\bРеспублики Казахстан\b', 'РК', s, flags=re.IGNORECASE)
    s = re.sub(r'\bРеспублике Казахстан\b', 'РК', s, flags=re.IGNORECASE)
    s = re.sub(r'\bРеспублика Казахстан\b', 'РК', s, flags=re.IGNORECASE)
    s = re.sub(r'\bРевизионная комиссия\b', 'Ревкомиссия', s, flags=re.IGNORECASE)
    s = re.sub(r'\bгорода\b', 'г.', s, flags=re.IGNORECASE)
    s = re.sub(r'\bгород\b', 'г.', s, flags=re.IGNORECASE)
    s = re.sub(r'\bобласти\b', 'обл.', s, flags=re.IGNORECASE)
    s = re.sub(r'\bобласть\b', 'обл.', s, flags=re.IGNORECASE)
    s = re.sub(r'\bрайона\b', 'р-на', s, flags=re.IGNORECASE)
    s = re.sub(r'\bрайон\b', 'р-н', s, flags=re.IGNORECASE)
    s = s.replace('\"', '').replace('«', '').replace('»', '').strip()

    if len(s) > 38:
        words = s.split()
        res = ''
        for w in words:
            if len(res) + len(w) + 1 <= 36:
                res = (res + ' ' + w).strip()
            else:
                break
        s = (res if res else s[:35]) + '...'

    return s

async def run():
    conn = await asyncpg.connect('postgresql://eotinish_platform:BFhekbn2026@localhost:5432/eotinish_ai_demo')
    rows = await conn.fetch('SELECT org_id, org_name_ru, short_name_ru FROM platform.gov_organizations_master')
    print(f'Cleaning names for {len(rows)} organizations...')

    updates = []
    for r in rows:
        cleaned = clean_org_name(r['org_id'], r['org_name_ru'], r['short_name_ru'])
        if cleaned != r['short_name_ru']:
            updates.append((cleaned, r['org_id']))

    print(f'Applying {len(updates)} clean short names to DB in batches...')
    # Batch update in transactions
    batch_size = 500
    for i in range(0, len(updates), batch_size):
        chunk = updates[i:i + batch_size]
        async with conn.transaction():
            for cleaned, org_id in chunk:
                await conn.execute(
                    "UPDATE platform.gov_organizations_master SET short_name_ru = $1, updated_at = now() WHERE org_id = $2",
                    cleaned, org_id
                )

    print('Done updating database!')

    sample = await conn.fetch(
        "SELECT org_id, short_name_ru, org_name_ru FROM platform.gov_organizations_master WHERE parent_id = 77 LIMIT 10"
    )
    for s in sample:
        print(f"[{s['org_id']}] => {s['short_name_ru']}")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(run())
