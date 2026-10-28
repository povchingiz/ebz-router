import { describe, it, expect } from 'vitest';
import { apiRequest } from './test_helpers';
import { pool } from '../../../src/lib/db';

describe('Lazy-Load, Search Correctness and Performance on 27k Orgs', () => {
  describe('1. Lazy Loading Correctness', () => {
    it('AUDIT DEFECT: GET /api/orgs?parent_id=77 returns 0 items due to broken regex in db.ts', async () => {
      // In PostgreSQL DB, parent_id = 77 has multiple organizations (central agencies)
      const dbCheck = await pool.query(
        'SELECT count(*) FROM platform.gov_organizations_master WHERE parent_id = 77 AND deleted = FALSE'
      );
      const actualCountInDb = parseInt(dbCheck.rows[0].count, 10);
      expect(actualCountInDb).toBeGreaterThan(0);

      // But via API /api/orgs?parent_id=77:
      const res = await apiRequest('/api/orgs?parent_id=77');
      expect(res.status).toBe(200);

      // The API returns 0 items because /^\\d+$/ does not match numeric '77', falling into slug lookup
      expect(res.data.data.length).toBe(0);
    });

    it('GET /api/orgs?parent_id=ap returns child ministries correctly from store/slug', async () => {
      const res = await apiRequest('/api/orgs?parent_id=ap');
      expect(res.status).toBe(200);
      expect(res.data.data.length).toBeGreaterThan(0);
    });
  });

  describe('2. Search Latency Benchmark (p50 and p95)', () => {
    it('measures p50 and p95 latency over 30 search queries', async () => {
      const queries = [
        'транспорт', 'энергетика', 'школа', 'больница', 'земля',
        'акимат', 'налог', 'экология', 'полиция', 'вода',
        'юстиция', 'суд', 'торговля', 'культура', 'туризм',
        'строительство', 'связь', 'пенсия', 'соцзащита', 'труд',
        'архив', 'спорт', 'ветеринария', 'таможня', 'прокуратура',
        'дороги', 'жкх', 'газ', 'лицензия', 'инспекция'
      ];

      const latencies: number[] = [];

      for (const q of queries) {
        const start = performance.now();
        const res = await apiRequest(`/api/orgs?q=${encodeURIComponent(q)}`);
        const duration = performance.now() - start;
        expect(res.status).toBe(200);
        latencies.push(duration);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];

      console.log(`\n--- SEARCH PERFORMANCE BENCHMARK (30 queries) ---`);
      console.log(`Min: ${latencies[0].toFixed(2)}ms`);
      console.log(`p50: ${p50.toFixed(2)}ms`);
      console.log(`p95: ${p95.toFixed(2)}ms`);
      console.log(`Max: ${latencies[latencies.length - 1].toFixed(2)}ms`);

      expect(p50).toBeDefined();
      expect(p95).toBeDefined();
    }, 30000);
  });

  describe('3. Database Query Plan & Missing Indexes (EXPLAIN ANALYZE)', () => {
    it('detects Parallel Seq Scan and correlated subquery (N+1) on search', async () => {
      const planRes = await pool.query(`
        EXPLAIN (FORMAT JSON, ANALYZE)
        SELECT 
          m.*,
          (SELECT COUNT(*) FROM platform.gov_organizations_master c WHERE c.parent_id = m.org_id AND c.deleted = FALSE)::int AS direct_children_count,
          p.slug as parent_slug,
          ks.status as knowledge_status,
          ks.has_human_touch,
          ks.completeness_score,
          ex.competencies_excluded,
          ex.forward_to_guidance,
          ex.phone_hotline,
          ex.phone_chancellery,
          ex.email_official,
          ex.website_url,
          ex.physical_address
        FROM platform.gov_organizations_master m
        LEFT JOIN platform.gov_organizations_master p ON m.parent_id = p.org_id
        LEFT JOIN knowledge.org_readiness_status ks ON m.org_id = ks.org_id
        LEFT JOIN knowledge.org_details_extra ex ON m.org_id = ex.org_id
        WHERE m.deleted = FALSE
        AND (m.org_name_ru ILIKE '%транспорт%' OR m.short_name_ru ILIKE '%транспорт%' OR m.slug ILIKE '%транспорт%' OR array_to_string(m.aliases, ' ') ILIKE '%транспорт%')
        LIMIT 50
      `);

      const planText = JSON.stringify(planRes.rows[0]);

      // Checks for Sequential Scan in the query plan
      const hasSeqScan = planText.includes('Seq Scan') || planText.includes('Parallel Seq Scan');
      expect(hasSeqScan).toBe(true);

      // Checks for SubPlan (correlated N+1 subquery for direct_children_count)
      const hasSubPlan = planText.includes('SubPlan') || planText.includes('direct_children_count');
      expect(hasSubPlan).toBe(true);
    });

    it('verifies missing indexes on search columns', async () => {
      // Check pg_indexes on platform.gov_organizations_master
      const res = await pool.query(`
        SELECT indexname, indexdef FROM pg_indexes 
        WHERE schemaname = 'platform' AND tablename = 'gov_organizations_master'
      `);
      const indexDefs = res.rows.map((r) => r.indexdef);

      // Look for GIN / trigram indexes on org_name_ru or short_name_ru
      const hasTrgmIndex = indexDefs.some((d) => d.includes('gin_trgm_ops') || d.includes('gist_trgm_ops'));
      expect(hasTrgmIndex).toBe(false); // Finding: pg_trgm index is MISSING!
    });
  });
});
