'use client';

import React, { useState } from 'react';
import { OrgQuestion } from '../types';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Table,
} from 'lucide-react';

interface QuestionCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (questions: OrgQuestion[]) => void;
}

const SAMPLE_CSV = `Тема;Суть вопроса;Ключевые слова;Типовой ответ
Тарифы на электроэнергию;Порядок формирования и перерасчета тарифов;тариф, свет, оплата, счетчик;Утверждение предельных тарифов осуществляется Департаментом КРЕМ в соответствии с Законом об электроэнергетике
Аварийное отключение света;Куда обращаться при аварии и перебоях энергоснабжения;авария, отключение, ремонт, сеть;При аварийных ситуациях обратитесь в круглосуточную диспетчерскую службу дежурного РЭС
Подключение к сетям;Технические условия для присоединения к электросетям;техусловия, подключение, мощность;Подача заявления на техусловия производится через портал eGov или канцелярию РЭК`;

export const QuestionCsvModal: React.FC<QuestionCsvModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [csvText, setCsvText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<OrgQuestion[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Разбор текста CSV
  const parseCsv = (text: string) => {
    setErrorMsg(null);
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setParsedQuestions([]);
      return;
    }

    // Определяем разделитель (; или , или \t)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

    const startIndex =
      firstLine.toLowerCase().includes('тема') || firstLine.toLowerCase().includes('topic')
        ? 1
        : 0;

    const list: OrgQuestion[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));

      const topic = cols[0] || '';
      const description = cols[1] || '';
      const rawKeywords = cols[2] || '';
      const sampleResponse = cols[3] || '';

      if (topic) {
        const keywords = rawKeywords
          .split(/[,;|]/)
          .map((k) => k.trim())
          .filter(Boolean);

        list.push({
          id: `q-csv-${Date.now()}-${i}`,
          topic,
          description: description || topic,
          keywords: keywords.length > 0 ? keywords : [topic.toLowerCase()],
          sampleResponse: sampleResponse || undefined,
        });
      }
    }

    if (list.length === 0) {
      setErrorMsg('Не удалось распознать строки вопросов. Проверьте разделитель.');
    } else {
      setParsedQuestions(list);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      parseCsv(content);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleTextChange = (val: string) => {
    setCsvText(val);
    parseCsv(val);
  };

  const downloadSample = () => {
    // Добавляем UTF-8 BOM (\uFEFF) для корректного открытия в русском Excel
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'obrazec_voprosov_ebz.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApply = () => {
    if (parsedQuestions.length === 0) return;
    onImport(parsedQuestions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden space-y-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Импорт вопросов и ответов из CSV
              </h3>
              <p className="text-xs text-slate-500">
                Массовая загрузка базы компетенций, ключевых слов и типовых ответов
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Формат и образец */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Структура колонок (разделитель «;»):
            </span>
            <code className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">
              Тема ; Суть вопроса ; Ключевые слова ; Типовой ответ
            </code>
          </div>

          <button
            type="button"
            onClick={downloadSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Шаблон CSV
          </button>
        </div>

        {/* Загрузка файла или вставка текста */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>Вставьте текст из Excel/CSV или выберите файл:</span>
            <label className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              <span>Выбрать файл .csv</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={`Вставьте сюда скопированные строки из Excel или CSV файла...\nНапример:\nТарифы на свет;Жалоба на стоимость электроэнергии;свет, тариф;Тарифы регулируются...`}
            className="w-full p-3 text-xs font-mono rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-blue-500 outline-none leading-relaxed"
          />
        </div>

        {/* Ошибка */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Превью таблицы */}
        {parsedQuestions.length > 0 && (
          <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Распознано вопросов: {parsedQuestions.length}
              </span>
              <span className="text-[11px] text-slate-400 font-normal">Превью первых строк</span>
            </div>

            <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="p-2 w-8">#</th>
                    <th className="p-2">Тема</th>
                    <th className="p-2">Суть / Жалоба</th>
                    <th className="p-2">Теги</th>
                    <th className="p-2">Типовой ответ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedQuestions.slice(0, 5).map((q, idx) => (
                    <tr key={q.id} className="text-[11px]">
                      <td className="p-2 font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-2 font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                        {q.topic}
                      </td>
                      <td className="p-2 text-slate-600 dark:text-slate-300 truncate max-w-[160px]">
                        {q.description}
                      </td>
                      <td className="p-2 text-slate-500 truncate max-w-[120px]">
                        {q.keywords.join(', ')}
                      </td>
                      <td className="p-2 text-slate-500 truncate max-w-[140px]">
                        {q.sampleResponse || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Футер */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={parsedQuestions.length === 0}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all disabled:opacity-40"
          >
            <CheckCircle2 className="w-4 h-4" />
            Добавить в карточку ({parsedQuestions.length})
          </button>
        </div>
      </div>
    </div>
  );
};
