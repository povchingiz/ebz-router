import asyncio
import asyncpg
import re

MINISTRY_RULES = [
    ("внутренних дел", "mvd", "МВД РК"),
    ("обороны", "minoborony", "Минобороны РК"),
    ("здравоохранения", "minzdrav", "Минздрав РК"),
    ("просвещения", "minpros", "Минпросвещения РК"),
    ("науки и высшего", "mnvo", "МНВО РК"),
    ("энергетики", "minenergo", "Минэнерго РК"),
    ("финансов", "minfin", "Минфин РК"),
    ("юстиции", "minjust", "Минюст РК"),
    ("промышленности и строительства", "mps", "Минпром РК"),
    ("культуры и информации", "mki", "Минкультуры РК"),
    ("туризма и спорта", "mts", "Минтуризма РК"),
    ("сельского хозяйства", "msh", "Минсельхоз РК"),
    ("торговли и интеграции", "mti", "Минторговли РК"),
    ("по чрезвычайным ситуациям", "mchs", "МЧС РК"),
    ("иностранных дел", "mid", "МИД РК"),
    ("национальной экономики", "mne", "МНЭ РК"),
    ("труда и социальной", "mintruda", "Минтруда РК"),
    ("экологии и природных", "mineco", "Минэкологии РК"),
    ("транспорта", "mintrans", "Минтранспорта РК"),
    ("водных ресурсов", "minvod", "Минводхоз РК"),
    ("искусственного интеллекта", "miicr", "МИИЦР"),
]

AGENCY_RULES = [
    ("делам государственной службы", "adgs", "АДГС"),
    ("финансовому мониторингу", "afm", "АФМ"),
    ("защите и развитию конкуренции", "azrk", "АЗРК"),
    ("регулированию и развитию финансового", "arrfr", "АРРФР"),
    ("стратегическому планированию", "aspir", "АСПИР"),
    ("атомной энергии", "atom", "Агентство атомной энергии"),
]

SPECIAL_RULES = [
    (77, "ap", "АП"),
    (30400, "gov", "Правительство РК"),
]

async def main():
    conn = await asyncpg.connect('postgresql://eotinish_platform:BFhekbn2026@localhost:5432/eotinish_ai_demo')
    print("Connected to PostgreSQL (eotinish_ai_demo)")

    # 1. Reset all erroneous slugs on subordinate non-head entities
    await conn.execute("UPDATE platform.gov_organizations_master SET slug = NULL WHERE slug IS NOT NULL")
    print("Reset slugs for clean re-mapping.")

    # 2. Map Special Roots
    for org_id, slug, short_name in SPECIAL_RULES:
        await conn.execute(
            "UPDATE platform.gov_organizations_master SET slug = $1, short_name_ru = $2, updated_at = now() WHERE org_id = $3",
            slug, short_name, org_id
        )
        print(f"Mapped root: [{org_id}] {slug} -> {short_name}")

    # 3. Map Ministries (parent_id = 30400, strictly central bodies)
    ministers = await conn.fetch(
        "SELECT org_id, org_name_ru FROM platform.gov_organizations_master WHERE parent_id = 30400 AND org_type_ru = 'Министерство'"
    )
    for m in ministers:
        name_lower = m['org_name_ru'].lower()
        matched = False
        for key, slug, short_name in MINISTRY_RULES:
            if key in name_lower:
                await conn.execute(
                    "UPDATE platform.gov_organizations_master SET slug = $1, short_name_ru = $2, updated_at = now() WHERE org_id = $3",
                    slug, short_name, m['org_id']
                )
                print(f"Mapped Ministry: [{m['org_id']}] {slug} -> {short_name} | Full: {m['org_name_ru']}")
                matched = True
                break
        if not matched:
            print(f"WARNING: Unmatched Ministry [{m['org_id']}]: {m['org_name_ru']}")

    # 4. Map Agencies (parent_id = 77, strictly central bodies)
    agencies = await conn.fetch(
        "SELECT org_id, org_name_ru FROM platform.gov_organizations_master WHERE parent_id = 77 AND (org_type_ru = 'Агентство' OR org_name_ru ILIKE '%Агентство%')"
    )
    for a in agencies:
        name_lower = a['org_name_ru'].lower()
        for key, slug, short_name in AGENCY_RULES:
            if key in name_lower:
                await conn.execute(
                    "UPDATE platform.gov_organizations_master SET slug = $1, short_name_ru = $2, updated_at = now() WHERE org_id = $3",
                    slug, short_name, a['org_id']
                )
                print(f"Mapped Agency: [{a['org_id']}] {slug} -> {short_name} | Full: {a['org_name_ru']}")
                break

    # 5. Check Constitutional / Law Enforcement bodies
    special_orgs = [
        ("Верховный Суд", "vs", "Верховный Суд РК"),
        ("Генеральная Прокуратура", "prokuratura", "Генпрокуратура РК"),
        ("Комитет национальной безопасности", "knb", "КНБ РК"),
    ]
    for key, slug, short_name in special_orgs:
        row = await conn.fetchrow(
            "SELECT org_id, org_name_ru FROM platform.gov_organizations_master WHERE parent_id = 77 AND org_name_ru ILIKE $1 LIMIT 1",
            f"%{key}%"
        )
        if row:
            await conn.execute(
                "UPDATE platform.gov_organizations_master SET slug = $1, short_name_ru = $2, updated_at = now() WHERE org_id = $3",
                slug, short_name, row['org_id']
            )
            print(f"Mapped Special: [{row['org_id']}] {slug} -> {short_name}")

    # 6. Verification: Check MVD vs Minoborony specifically
    mvd = await conn.fetchrow("SELECT org_id, slug, short_name_ru, org_name_ru FROM platform.gov_organizations_master WHERE slug = 'mvd'")
    mo = await conn.fetchrow("SELECT org_id, slug, short_name_ru, org_name_ru FROM platform.gov_organizations_master WHERE slug = 'minoborony'")
    print("\n=== VERIFICATION RESULTS ===")
    print("MVD:", dict(mvd) if mvd else "NOT FOUND")
    print("MO: ", dict(mo) if mo else "NOT FOUND")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
