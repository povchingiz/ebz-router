import asyncio
import asyncpg
import json
import re

async def main():
    conn = await asyncpg.connect('postgresql://eotinish_platform:BFhekbn2026@localhost:5432/eotinish_ai_demo')
    print("Connected to PostgreSQL (eotinish_ai_demo)")

    # 1. Total records in master
    total_master = await conn.fetchval("SELECT count(*) FROM platform.gov_organizations_master")
    print(f"Total organizations in master: {total_master}")

    # 2. Enrich from all_566_orgs.json
    with open('/home/chingiz/Desktop/projectstier/ebz-router/src/data/all_566_orgs.json', 'r', encoding='utf-8') as f:
        existing_orgs = json.load(f)
    print(f"Loaded {len(existing_orgs)} existing orgs from JSON")

    mapped = 0
    faq_added = 0

    for item in existing_orgs:
        slug = item['id']
        name = item['name']
        full_name = item.get('fullName', '')
        scope = item.get('scope', '')
        questions = item.get('questions', [])

        target_id = None
        if slug == 'ap':
            target_id = 77
        elif slug == 'gov':
            target_id = 30400
        else:
            # Clean name for search
            clean_name = re.sub(r'[^а-яА-ЯёЁa-zA-Z0-9\s]', ' ', full_name).strip()
            words = [w for w in clean_name.split() if len(w) > 3][:3]
            if words:
                query_str = "%" + "%".join(words) + "%"
                row = await conn.fetchrow(
                    "SELECT org_id FROM platform.gov_organizations_master WHERE org_name_ru ILIKE $1 LIMIT 1",
                    query_str
                )
                if row:
                    target_id = row['org_id']

        if target_id:
            try:
                await conn.execute(
                    """
                    UPDATE platform.gov_organizations_master
                    SET slug = $1, short_name_ru = $2, scope = $3, updated_at = now()
                    WHERE org_id = $4
                    """,
                    slug, name, scope, target_id
                )
                mapped += 1
            except Exception as e:
                # slug might collide, skip slug update but update name/scope
                await conn.execute(
                    """
                    UPDATE platform.gov_organizations_master
                    SET short_name_ru = $1, scope = $2, updated_at = now()
                    WHERE org_id = $3
                    """,
                    name, scope, target_id
                )
                mapped += 1

            for q in questions:
                await conn.execute(
                    """
                    INSERT INTO platform.gov_organization_faq (org_id, question_ru, answer_ru, tags)
                    VALUES ($1, $2, $3, $4::jsonb)
                    """,
                    target_id, q.get('topic', ''), q.get('description', ''), json.dumps(q.get('keywords', []))
                )
                faq_added += 1

    print(f"Successfully mapped {mapped} organizations and inserted {faq_added} FAQ entries.")

    # 3. Verify top roots
    roots = await conn.fetch(
        """
        SELECT org_id, slug, short_name_ru, org_name_ru, path, org_type_ru 
        FROM platform.gov_organizations_master 
        WHERE parent_id IS NULL OR org_id IN (77, 30400, 17875, 17850)
        LIMIT 10
        """
    )
    print("\n=== Key Root Organizations in DB ===")
    for r in roots:
        print(f"[{r['org_id']}] slug={r['slug']} | {r['short_name_ru']} | type={r['org_type_ru']} | path={r['path']}")

    faq_count = await conn.fetchval("SELECT count(*) FROM platform.gov_organization_faq")
    print(f"\nTotal FAQ records in database: {faq_count}")
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
