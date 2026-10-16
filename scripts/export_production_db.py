import asyncio
import asyncpg
import gzip
import json
import os
import sys

CONNECTION_STRING = os.getenv(
    "DATABASE_URL",
    "postgresql://eotinish_platform:BFhekbn2026@localhost:5432/eotinish_ai_demo"
)

TABLES_TO_EXPORT = [
    "roles",
    "permissions",
    "role_permissions",
    "users",
    "settings",
    "gov_organizations_master",
    "gov_organizations",
    "gov_organization_faq",
    "tag_lexicon",
    "digest_subtopics",
    "analytics_snapshots",
    "tag_rollup",
    "tag_org_rollup",
    "tag_trend_daily"
]

def format_sql_value(val):
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (dict, list)):
        dumped = json.dumps(val, ensure_ascii=False)
        escaped = dumped.replace("'", "''")
        return f"'{escaped}'"
    # string, date, datetime, etc.
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"

async def get_table_ddl(conn, table_name: str) -> str:
    cols = await conn.fetch("""
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'platform' AND table_name = $1
        ORDER BY ordinal_position
    """, table_name)
    
    col_defs = []
    for col in cols:
        cname = col['column_name']
        dtype = col['data_type']
        udt = col['udt_name']
        is_null = col['is_nullable'] == 'YES'
        default = col['column_default']
        
        # Determine SQL type
        if dtype == 'ARRAY':
            type_str = f"{udt.lstrip('_')}[]"
        elif dtype == 'USER-DEFINED':
            type_str = udt
        else:
            type_str = dtype
            
        def_clause = f'"{cname}" {type_str}'
        if not is_null:
            def_clause += " NOT NULL"
        if default and not default.startswith("nextval"):
            def_clause += f" DEFAULT {default}"
        elif default and default.startswith("nextval"):
            # Serial or sequence
            if "bigint" in dtype or "int8" in udt:
                def_clause = f'"{cname}" BIGSERIAL'
            else:
                def_clause = f'"{cname}" SERIAL'
            if not is_null:
                def_clause += " NOT NULL"
        col_defs.append(def_clause)
        
    return f'CREATE TABLE IF NOT EXISTS platform."{table_name}" (\n  ' + ",\n  ".join(col_defs) + "\n);"

async def export_db():
    print(f"Connecting to database: {CONNECTION_STRING}...")
    conn = await asyncpg.connect(CONNECTION_STRING)
    
    out_path = os.path.join(os.path.dirname(__file__), "..", "initdb", "01_eotinish_master_27k.sql.gz")
    print(f"Exporting to {out_path}...")
    
    with gzip.open(out_path, "wt", encoding="utf-8") as gz:
        gz.write("-- E-Otinish / EBZ Master 27,164 Organizations Database Dump for Closed Network (Air-Gapped)\n")
        gz.write("-- Generated for ЕТС ГО / АО НИТ on-premise deployment\n\n")
        gz.write("CREATE SCHEMA IF NOT EXISTS platform;\n")
        gz.write("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n")
        gz.write("CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";\n\n")
        
        for table in TABLES_TO_EXPORT:
            print(f"Exporting table platform.{table}...")
            # DDL
            try:
                ddl = await get_table_ddl(conn, table)
                gz.write(f"-- Table: platform.{table}\n")
                gz.write(ddl + "\n\n")
            except Exception as e:
                print(f"  Warning getting DDL for {table}: {e}")
                continue
                
            # Fetch data in batches
            count = await conn.fetchval(f'SELECT count(*) FROM platform."{table}"')
            print(f"  Rows to export: {count}")
            if count == 0:
                continue
                
            # Get column names
            cols_info = await conn.fetch("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'platform' AND table_name = $1
                ORDER BY ordinal_position
            """, table)
            col_names = [c['column_name'] for c in cols_info]
            col_list_str = ", ".join([f'"{c}"' for c in col_names])
            
            offset = 0
            batch_size = 1000
            while offset < count:
                rows = await conn.fetch(f'SELECT * FROM platform."{table}" LIMIT {batch_size} OFFSET {offset}')
                if not rows:
                    break
                
                insert_lines = []
                for row in rows:
                    values = [format_sql_value(row[c]) for c in col_names]
                    insert_lines.append(f"  ({', '.join(values)})")
                
                gz.write(f'INSERT INTO platform."{table}" ({col_list_str}) VALUES\n' + ",\n".join(insert_lines) + "\nON CONFLICT DO NOTHING;\n\n")
                offset += len(rows)
            print(f"  Finished {table}: {offset} rows written.")
            
        # Add Indexes
        print("Writing optimized indexes...")
        gz.write("\n-- Indexes for Ultra-Fast Search across 27,164 records\n")
        gz.write("CREATE INDEX IF NOT EXISTS idx_gov_orgs_master_trgm ON platform.gov_organizations_master USING gin (org_name_ru gin_trgm_ops);\n")
        gz.write("CREATE INDEX IF NOT EXISTS idx_gov_orgs_master_parent ON platform.gov_organizations_master (parent_id);\n")
        gz.write("CREATE INDEX IF NOT EXISTS idx_gov_orgs_master_path ON platform.gov_organizations_master (path);\n")
        gz.write("CREATE INDEX IF NOT EXISTS idx_gov_orgs_master_slug ON platform.gov_organizations_master (slug);\n")
        gz.write("CREATE INDEX IF NOT EXISTS idx_gov_orgs_master_scope_trgm ON platform.gov_organizations_master USING gin (scope gin_trgm_ops);\n")
        gz.write("CREATE INDEX IF NOT EXISTS idx_gov_faq_org_id ON platform.gov_organization_faq (org_id);\n")
        gz.write("CREATE INDEX IF NOT EXISTS idx_users_email ON platform.users (email);\n")
        
    await conn.close()
    file_size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"\nSUCCESS! Database dump created: {out_path} ({file_size_mb:.2f} MB)")

if __name__ == "__main__":
    asyncio.run(export_db())
