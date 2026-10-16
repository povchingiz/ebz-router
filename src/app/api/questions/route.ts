import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { validateAndParseExcel } from '@/lib/excelSecurity';
import { OrgQuestion } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/questions
 * Выгрузка официального образца вопросов и тем обращений в реальном формате Excel (.xlsx)
 */
export async function GET(req: NextRequest) {
  try {
    const sampleRows = [
      {
        'Тематика / Вопрос обращения': 'Тарифы на коммунальные услуги и электроэнергию',
        'Суть обращения / Описание ситуации': 'Жалобы на необоснованное повышение тарифов на электроэнергию, отопление и воду, порядок перерасчета начислений.',
        'Ключевые слова для ИИ и поиска': 'тариф, свет, счетчик, квитанция, перерасчет, комуслуги, тепло',
        'Регламент решения / Типовой ответ': 'Утверждение тарифов естественных монополий относится к компетенции Комитета по регулированию естественных монополий (КРЕМ). Направлять в Департамент КРЕМ по региону.',
      },
      {
        'Тематика / Вопрос обращения': 'Назначение адресной социальной помощи (АСП)',
        'Суть обращения / Описание ситуации': 'Отказ в назначении АСП в связи с расчетом совокупного дохода семьи, порядок подтверждения статуса и задержки выплат.',
        'Ключевые слова для ИИ и поиска': 'АСП, социальная помощь, доход семьи, пособие, черта бедности, соцзащита',
        'Регламент решения / Типовой ответ': 'Рассмотрение заявлений на АСП осуществляется Карьерными центрами и Управлениями занятости и социальных программ при местных акиматах.',
      },
      {
        'Тематика / Вопрос обращения': 'Очередь на получение жилья из государственного фонда',
        'Суть обращения / Описание ситуации': 'Проверка статуса в очереди на жилье, снятие с очереди, льготные категории (многодетные семьи, сироты, инвалиды).',
        'Ключевые слова для ИИ и поиска': 'очередь на жилье, арендное жилье, соцжилье, акимат, отбасы банк, категория',
        'Регламент решения / Типовой ответ': 'Формирование и учет списков очередников ведет Управление жилья и жилищной инспекции акимата города/района.',
      },
      {
        'Тематика / Вопрос обращения': 'Качество дорожного покрытия и ремонт дорог',
        'Суть обращения / Описание ситуации': 'Ямы, отсутствие асфальта на внутрипоселковых дорогах, неочищенные дороги зимой, разбитый тротуар.',
        'Ключевые слова для ИИ и поиска': 'ремонт дорог, ямы, асфальт, тротуар, уборка снега, дорожное полотно',
        'Регламент решения / Типовой ответ': 'Обслуживание и текущий ремонт автодорог местного значения находится в ведении Отдела пассажирского транспорта и автомобильных дорог районного/городского акимата.',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);

    // Устанавливаем ширину колонок для читаемости в Excel
    worksheet['!cols'] = [
      { wch: 45 }, // Тематика
      { wch: 60 }, // Суть обращения
      { wch: 40 }, // Ключевые слова
      { wch: 65 }, // Регламент решения
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Вопросы компетенций');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="obrazec_tem_i_voprosov_ebz.xlsx"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/questions
 * Загрузка и проверка файла вопросов с проверкой Magic Bytes и защитой от Zip-бомб
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Файл не был прикреплен к запросу' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Проверка безопасности: Magic Bytes, расширение, проверка на Zip-бомбы
    const secResult = validateAndParseExcel(buffer, file.name);

    if (!secResult.isValid || !secResult.rows) {
      return NextResponse.json(
        { error: secResult.error || 'Ошибка проверки безопасности файла Excel' },
        { status: 400 }
      );
    }

    // Извлечение и валидация вопросов из строк листа
    const questions: OrgQuestion[] = [];
    const rows = secResult.rows;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // Поддержка различных вариантов заголовков
      const topic = String(
        r['Тематика / Вопрос обращения'] ||
          r['Тема'] ||
          r['Вопрос'] ||
          r['topic'] ||
          r['Тематика'] ||
          ''
      ).trim();

      const description = String(
        r['Суть обращения / Описание ситуации'] ||
          r['Суть вопроса'] ||
          r['Описание'] ||
          r['description'] ||
          topic
      ).trim();

      const rawKeywords = String(
        r['Ключевые слова для ИИ и поиска'] ||
          r['Ключевые слова'] ||
          r['keywords'] ||
          ''
      ).trim();

      const sampleResponse = String(
        r['Регламент решения / Типовой ответ'] ||
          r['Типовой ответ'] ||
          r['Регламент'] ||
          r['sampleResponse'] ||
          ''
      ).trim();

      if (topic) {
        const keywords = rawKeywords
          .split(/[,;|]/)
          .map((k) => k.trim())
          .filter(Boolean);

        questions.push({
          id: `q-excel-${Date.now()}-${i + 1}`,
          topic,
          description: description || topic,
          keywords: keywords.length > 0 ? keywords : [topic.toLowerCase()],
          sampleResponse: sampleResponse || undefined,
        });
      }
    }

    if (questions.length === 0) {
      return NextResponse.json(
        {
          error:
            'В файле не найдено строк с заполненной колонкой «Тематика / Вопрос обращения». Проверьте соответствие колонок образцу.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      questions,
      count: questions.length,
      security: {
        totalRows: secResult.totalRows,
        compressedSize: secResult.compressedSize,
        uncompressedSize: secResult.uncompressedSize,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка обработки файла' },
      { status: 500 }
    );
  }
}
