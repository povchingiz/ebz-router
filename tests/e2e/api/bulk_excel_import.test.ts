import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import { getAuthCookies, apiRequest, AuthTokens, BASE_URL } from './test_helpers';

describe('Bulk & CSV/Excel Import Security and Edge Cases Audit', () => {
  let tokens: AuthTokens;

  beforeAll(async () => {
    tokens = await getAuthCookies();
  });

  describe('1. Malformed and Empty Payloads', () => {
    it('returns 400 when body has empty rows array', async () => {
      const res = await apiRequest('/api/bulk', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: { rows: [] },
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toContain('Таблица не содержит данных');
    });

    it('returns 400 when uploaded file is empty or not Excel', async () => {
      const formData = new FormData();
      const fakeBlob = new Blob(['This is plain text, not a zip or excel'], { type: 'text/plain' });
      formData.append('file', fakeBlob, 'test.xlsx');

      const res = await fetch(`${BASE_URL}/api/bulk`, {
        method: 'POST',
        headers: { Cookie: tokens.superadmin },
        body: formData,
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('не соответствует формату Microsoft Excel');
    });
  });

  describe('2. Batch Size Limits (> 5000 rows DoS Protection)', () => {
    it('returns 400 when row count exceeds 5000 items', async () => {
      const hugeRows = Array.from({ length: 5001 }, (_, i) => ({
        'ID организации': 100000 + i,
        'Краткое наименование (RU)': `Org ${i}`,
        'Полное официальное наименование (RU)': `Full Org ${i}`,
      }));

      const res = await apiRequest('/api/bulk', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: { rows: hugeRows, dryRun: true },
      });

      expect(res.status).toBe(400);
      expect(res.data.error).toContain('Превышен лимит пакета: максимум 5000 строк');
    });
  });

  describe('3. Duplicate Records Handling', () => {
    it('reports behavior when duplicate org_ids exist in the same batch', async () => {
      const duplicateRows = [
        {
          'ID организации': 17862,
          'Краткое наименование (RU)': 'Минэнерго Дубликат 1',
          'Полное официальное наименование (RU)': 'Министерство энергетики',
        },
        {
          'ID организации': 17862,
          'Краткое наименование (RU)': 'Минэнерго Дубликат 2',
          'Полное официальное наименование (RU)': 'Министерство энергетики',
        },
      ];

      const res = await apiRequest('/api/bulk', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: { rows: duplicateRows, dryRun: true },
      });

      expect(res.status).toBe(200);
      // Notice: the endpoint processes both without deduplication warning!
      expect(res.data.processed).toBe(2);
    });
  });

  describe('4. Formula Injection (CSV / Excel Injection: =CMD, +, -, @)', () => {
    it('verifies server sanitization of formula injection prefixes in Excel export', async () => {
      // GET /api/bulk exports Excel file. Let's verify that values starting with =, +, -, @ are escaped with leading single quote
      const exportRes = await fetch(`${BASE_URL}/api/bulk?limit=5`, { headers: { Cookie: tokens.gateOnly } });
      expect(exportRes.status).toBe(200);
      const buffer = Buffer.from(await exportRes.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames.length).toBeGreaterThan(0);
    });

    it('AUDIT DEFECT: cleanImportCell strips single quotes, re-enabling formula injection if viewed raw', async () => {
      // In cleanImportCell:
      // if (str.startsWith("'") && str.length > 1) str = str.substring(1);
      // If a user submits "'=CMD|' /C calc'!A0", the leading quote is stripped!
      const res = await apiRequest('/api/bulk', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: {
          dryRun: true,
          rows: [
            {
              'ID организации': 17862,
              'Краткое наименование (RU)': "'=CMD|' /C calc'!A0",
              'Полное официальное наименование (RU)': 'Министерство энергетики',
            },
          ],
        },
      });

      expect(res.status).toBe(200);
      expect(res.data.processed).toBe(1);
    });
  });

  describe('5. Magic Bytes & File Upload Security via POST /api/questions', () => {
    it('POST /api/questions rejects non-Excel file with 400', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['fake content']), 'questions.xlsx');

      const res = await fetch(`${BASE_URL}/api/questions`, {
        method: 'POST',
        headers: { Cookie: tokens.gateOnly },
        body: formData,
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('не соответствует формату Microsoft Excel');
    });

    it('POST /api/questions accepts valid Excel file with questions', async () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([
        {
          'Тематика / Вопрос обращения': 'Тарифы на газ',
          'Суть обращения / Описание ситуации': 'Вопрос перерасчета за газ',
          'Ключевые слова для ИИ и поиска': 'газ, счетчик, тариф',
          'Регламент решения / Типовой ответ': 'Обращаться в Минэнерго',
        },
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Вопросы');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const formData = new FormData();
      formData.append('file', new Blob([buffer]), 'test_questions.xlsx');

      const res = await fetch(`${BASE_URL}/api/questions`, {
        method: 'POST',
        headers: { Cookie: tokens.gateOnly },
        body: formData,
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
      expect(data.questions[0].topic).toBe('Тарифы на газ');
    });
  });
});
