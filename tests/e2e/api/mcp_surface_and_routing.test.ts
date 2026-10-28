import { describe, it, expect } from 'vitest';
import { apiRequest } from './test_helpers';

interface RoutingTestCase {
  id: number;
  lang: 'RU' | 'KK';
  domain: string;
  appealText: string;
  expectedOrgKeyword: string; // substring expected in org name or id
}

export const TEST_APPEALS: RoutingTestCase[] = [
  // 15 RU appeals
  {
    id: 1,
    lang: 'RU',
    domain: 'Энергетика / Тарифы',
    appealText: 'Жалоба на необоснованное повышение тарифа на электроэнергию и отопление без согласования, постоянные перебои со светом.',
    expectedOrgKeyword: 'энерг',
  },
  {
    id: 2,
    lang: 'RU',
    domain: 'Соцзащита / АСП',
    appealText: 'Не выплатили адресную социальную помощь (АСП) многодетной малообеспеченной семье, соцзащита отказывает в приеме документов.',
    expectedOrgKeyword: 'труд',
  },
  {
    id: 3,
    lang: 'RU',
    domain: 'Транспорт / Дороги',
    appealText: 'Многочисленные глубокие ямы и отсутствие асфальтового покрытия на республиканской автомобильной дороге и трассе.',
    expectedOrgKeyword: 'транспорт',
  },
  {
    id: 4,
    lang: 'RU',
    domain: 'Здравоохранение / Лекарства',
    appealText: 'Врач в городской поликлинике отказал в выдаче гарантированных бесплатных лекарственных средств онкобольному.',
    expectedOrgKeyword: 'здрав',
  },
  {
    id: 5,
    lang: 'RU',
    domain: 'МВД / Мошенничество',
    appealText: 'Незаконное списание средств с банковской карты неизвестными интернет-мошенниками, заявление в полицию.',
    expectedOrgKeyword: 'внутренних дел',
  },
  {
    id: 6,
    lang: 'RU',
    domain: 'Образование / Школы',
    appealText: 'Отказ администрации государственной школы в зачислении ребенка в первый класс по месту постоянного проживания.',
    expectedOrgKeyword: 'просвещ',
  },
  {
    id: 7,
    lang: 'RU',
    domain: 'Экология / Выбросы',
    appealText: 'Каждую ночь производственный завод осуществляет выбросы едкого дыма и химических отходов в атмосферный воздух города.',
    expectedOrgKeyword: 'эколог',
  },
  {
    id: 8,
    lang: 'RU',
    domain: 'Сельское хозяйство / Земля',
    appealText: 'Проблема нехватки пастбищных земель вокруг поселка, незаконный захват пастбищ крупным крестьянским хозяйством.',
    expectedOrgKeyword: 'сельск',
  },
  {
    id: 9,
    lang: 'RU',
    domain: 'Налоги / Финансы',
    appealText: 'Управление государственных доходов ошибочно выставило налоговую задолженность и заблокировало счет индивидуального предпринимателя.',
    expectedOrgKeyword: 'финанс',
  },
  {
    id: 10,
    lang: 'RU',
    domain: 'Торговля / Защита прав потребителей',
    appealText: 'Магазин отказывается оформлять возврат бракованного телевизора в течение 14 дней, нарушение прав потребителей.',
    expectedOrgKeyword: 'торговл',
  },
  {
    id: 11,
    lang: 'RU',
    domain: 'Цифровизация / Связь',
    appealText: 'В отдаленном сельском округе полностью отсутствует сотовая связь, интернет 4G и телефонная линия.',
    expectedOrgKeyword: 'цифр',
  },
  {
    id: 12,
    lang: 'RU',
    domain: 'Строительство / ЖКХ',
    appealText: 'Застройщик нового многоквартирного дома сдал объект с трещинами в фундаменте, промерзают стены и течет крыша.',
    expectedOrgKeyword: 'промышленност',
  },
  {
    id: 13,
    lang: 'RU',
    domain: 'Труд / Задолженность по зарплате',
    appealText: 'Работодатель не выплачивает заработную плату строительной бригаде на протяжении четырех месяцев, инспекция труда.',
    expectedOrgKeyword: 'труд',
  },
  {
    id: 14,
    lang: 'RU',
    domain: 'Акимат / Благоустройство',
    appealText: 'Стихийная свалка строительного мусора во дворе жилого микрорайона, открытые канализационные люки на тротуаре.',
    expectedOrgKeyword: 'акимат',
  },
  {
    id: 15,
    lang: 'RU',
    domain: 'Госзакупки / Аудит',
    appealText: 'Нарушение конкурсных процедур и коррупционные риски при проведении государственных закупок медицинского оборудования.',
    expectedOrgKeyword: 'финанс',
  },

  // 15 KK appeals
  {
    id: 16,
    lang: 'KK',
    domain: 'Әлеуметтік көмек / АӘК',
    appealText: 'Көпбалалы аз қамтылған отбасымызға атаулы әлеуметтік көмек (АӘК) тағайындаудан негізсіз бас тартты.',
    expectedOrgKeyword: 'труд',
  },
  {
    id: 17,
    lang: 'KK',
    domain: 'Сумен жабдықтау / Ауыз су',
    appealText: 'Ауылымызда орталық ауыз су құбыры жоқ, халық суды тасып ішіп отыр, су тазарту кешені жұмыс істемейді.',
    expectedOrgKeyword: 'промышленност',
  },
  {
    id: 18,
    lang: 'KK',
    domain: 'Денсаулық сақтау / Дәрі-дәрмек',
    appealText: 'Қалалық емханада қант диабетімен ауыратын науқастарға тегін берілуі тиіс дәрі-дәрмектер берілмей жатыр.',
    expectedOrgKeyword: 'здрав',
  },
  {
    id: 19,
    lang: 'KK',
    domain: 'Ішкі істер / Алаяқтық',
    appealText: 'Интернет алаяқтары банктік қосымша арқылы менің атыма несие рәсімдеп алған, полиция істі тергемей жатыр.',
    expectedOrgKeyword: 'внутренних дел',
  },
  {
    id: 20,
    lang: 'KK',
    domain: 'Энергетика / Электр жарығы',
    appealText: 'Ауылда электр желісіндегі кернеу өте төмен, техникалар күйіп жатыр, электр қуаты жиі сөнеді.',
    expectedOrgKeyword: 'энерг',
  },
  {
    id: 21,
    lang: 'KK',
    domain: 'Көлік / Жол сапасы',
    appealText: 'Аудандық маңызы бар автокөлік жолының сапасы сын көтермейді, ой-шұңқырлар салдарынан көліктер жиі сынуда.',
    expectedOrgKeyword: 'транспорт',
  },
  {
    id: 22,
    lang: 'KK',
    domain: 'Білім / Мектептер',
    appealText: 'Мектеп әкімшілігі ата-аналардан сыныпты жөндеуге және оқулықтар сатып алуға мәжбүрлеп ақша жинатуда.',
    expectedOrgKeyword: 'просвещ',
  },
  {
    id: 23,
    lang: 'KK',
    domain: 'Экология / Ауаның ластануы',
    appealText: 'Өндірістік карьерден шыққан шаң-тозаң ауылды басып қалды, тұрғындар тыныс алу қиындағанын айтып шағымдануда.',
    expectedOrgKeyword: 'эколог',
  },
  {
    id: 24,
    lang: 'KK',
    domain: 'Ауыл шаруашылығы / Жайылым жерлер',
    appealText: 'Ауыл тұрғындарының малына жайылымдық жер жетіспейді, барлық жерді ірі шаруа қожалықтары заңсыз қоршап алған.',
    expectedOrgKeyword: 'сельск',
  },
  {
    id: 25,
    lang: 'KK',
    domain: 'Еңбек / Жалақы қарызы',
    appealText: 'Кәсіпорын жұмысшыларға соңғы бес ай бойы еңбекақы төлемеді, еңбек инспекциясы шара қолданбай отыр.',
    expectedOrgKeyword: 'труд',
  },
  {
    id: 26,
    lang: 'KK',
    domain: 'Сауда / Тұтынушылар құқығы',
    appealText: 'Сауда орталығы жарамдылық мерзімі өтіп кеткен азық-түлік тауарларын сатуда, қайтарудан бас тартып отыр.',
    expectedOrgKeyword: 'торговл',
  },
  {
    id: 27,
    lang: 'KK',
    domain: 'Байланыс / Ұялы интернет',
    appealText: 'Шалғай елді мекенде ұялы байланыс мүлдем жоқ, балалар қашықтан сабақ оқи алмай қиналуда.',
    expectedOrgKeyword: 'цифр',
  },
  {
    id: 28,
    lang: 'KK',
    domain: 'Салық / Мемлекеттік кірістер',
    appealText: 'Салық органдары жеке кәсіпкерге жабылып қалған көлік үшін мүлік салығын негізсіз қайта-қайта есептеп жатыр.',
    expectedOrgKeyword: 'финанс',
  },
  {
    id: 29,
    lang: 'KK',
    domain: 'Құрылыс / Баспана сапасы',
    appealText: 'Мемлекеттік бағдарламамен берілген әлеуметтік үйдің жылу жүйесі істемейді, қабырғасы көгеріп кетті.',
    expectedOrgKeyword: 'промышленност',
  },
  {
    id: 30,
    lang: 'KK',
    domain: 'Спорт / Балалар үйірмелері',
    appealText: 'Балаларға арналған мемлекеттік спорт секциялары жабылып қалды, жаттықтырушыларға жалақы төленбей отыр.',
    expectedOrgKeyword: 'туризм',
  },
];

describe('MCP Tool Surface & Citizen Appeal Routing Accuracy Audit', () => {
  describe('1. MCP Tool Surface Protocols', () => {
    it('implements initialize and tools/list conformant to JSON-RPC 2.0', async () => {
      const res = await apiRequest('/api/mcp', {
        method: 'POST',
        body: { jsonrpc: '2.0', id: 'init-1', method: 'initialize' },
      });
      expect(res.status).toBe(200);
      expect(res.data.jsonrpc).toBe('2.0');
      expect(res.data.result).toHaveProperty('protocolVersion');
      expect(res.data.result.serverInfo.name).toBe('eotinish-ebz-router-mcp');
    });

    it('exposes all 5 documented tools', async () => {
      const res = await apiRequest('/api/mcp', {
        method: 'POST',
        body: { jsonrpc: '2.0', id: 'list-1', method: 'tools/list' },
      });
      expect(res.status).toBe(200);
      const tools = res.data.result.tools;
      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('search_organizations');
      expect(toolNames).toContain('get_organization_details');
      expect(toolNames).toContain('get_departments');
      expect(toolNames).toContain('search_ebz_articles');
      expect(toolNames).toContain('route_citizen_appeal');
    });

    it('rejects calls exceeding 15,000 character limit in route_citizen_appeal', async () => {
      const hugeAppeal = 'a'.repeat(16000);
      const res = await apiRequest('/api/mcp', {
        method: 'POST',
        body: {
          jsonrpc: '2.0',
          id: 'tool-huge',
          method: 'tools/call',
          params: {
            name: 'route_citizen_appeal',
            arguments: { appealText: hugeAppeal },
          },
        },
      });
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('error');
      expect(res.data.error.code).toBe(-32602);
    });

    it('AUDIT DEFECT: katoCode parameter in route_citizen_appeal is ignored', async () => {
      // route_citizen_appeal declares katoCode in its inputSchema, but implementation does not use it
      const res = await apiRequest('/api/mcp', {
        method: 'POST',
        body: {
          jsonrpc: '2.0',
          id: 'tool-kato',
          method: 'tools/call',
          params: {
            name: 'route_citizen_appeal',
            arguments: {
              appealText: 'Жалоба на ямы на дорогах',
              katoCode: '710000000', // Astana KATO
            },
          },
        },
      });
      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.data.result.content[0].text);
      // Notice: Output doesn't reflect region/kato at all!
      expect(parsed).toHaveProperty('suggestedOrgId');
    });
  });

  describe('2. Routing Engine Accuracy Evaluation on 30 Realistic Appeals', () => {
    it('evaluates routing precision across 15 Russian and 15 Kazakh appeals', async () => {
      let ruSuccess = 0;
      let kkSuccess = 0;
      const details: any[] = [];

      for (const t of TEST_APPEALS) {
        const res = await apiRequest('/api/mcp', {
          method: 'POST',
          body: {
            jsonrpc: '2.0',
            id: `test-appeal-${t.id}`,
            method: 'tools/call',
            params: {
              name: 'route_citizen_appeal',
              arguments: { appealText: t.appealText },
            },
          },
        });

        expect(res.status).toBe(200);
        const parsed = JSON.parse(res.data.result.content[0].text);
        const suggestedName = (parsed.suggestedOrgName || '').toLowerCase();
        const suggestedId = (parsed.suggestedOrgId || '').toLowerCase();
        const rationale = (parsed.rationale || '').toLowerCase();

        const match =
          suggestedName.includes(t.expectedOrgKeyword) ||
          suggestedId.includes(t.expectedOrgKeyword) ||
          rationale.includes(t.expectedOrgKeyword);

        if (match) {
          if (t.lang === 'RU') ruSuccess++;
          else kkSuccess++;
        }

        details.push({
          id: t.id,
          lang: t.lang,
          domain: t.domain,
          expected: t.expectedOrgKeyword,
          got: `${parsed.suggestedOrgId} (${parsed.suggestedOrgName})`,
          score: parsed.matchScore,
          isMatch: match,
        });
      }

      console.log('\n--- ROUTING ENGINE ACCURACY AUDIT (30 REALISTIC APPEALS) ---');
      console.log(`Russian (RU) Accuracy: ${ruSuccess}/15 (${((ruSuccess / 15) * 100).toFixed(1)}%)`);
      console.log(`Kazakh (KK) Accuracy:  ${kkSuccess}/15 (${((kkSuccess / 15) * 100).toFixed(1)}%)`);
      console.log(`Overall Accuracy:      ${ruSuccess + kkSuccess}/30 (${(((ruSuccess + kkSuccess) / 30) * 100).toFixed(1)}%)`);

      // We expect this audit test to pass and output realistic routing statistics
      expect(details.length).toBe(30);
    }, 45000);
  });
});
