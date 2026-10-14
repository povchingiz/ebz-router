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
  ShieldCheck,
  Loader2,
  FileCheck,
} from 'lucide-react';

interface QuestionCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (questions: OrgQuestion[]) => void;
}

export const QuestionCsvModal: React.FC<QuestionCsvModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<OrgQuestion[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [securityInfo, setSecurityInfo] = useState<{
    totalRows?: number;
    compressedSize?: number;
    uncompressedSize?: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Проверка расширения на клиенте
    const isExcel =
      selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');

    if (!isExcel) {
      setErrorMsg('Поддерживаются исключительно файлы таблиц Excel (.xlsx, .xls). Загрузка CSV запрещена.');
      setFile(null);
      setParsedQuestions([]);
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setIsLoading(true);
    setParsedQuestions([]);
    setSecurityInfo(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Отправляем на бэкенд с защитой от Zip-бомб и проверкой Magic Bytes
      const res = await fetch('/api/questions', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка проверки и разбора файла');
      }

      setParsedQuestions(data.questions || []);
      setSecurityInfo(data.security || null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Не удалось обработать файл');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    // Скачивание официального образца через защищенный API
    window.location.href = '/api/questions';
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
                Импорт вопросов и тем обращений (Excel .xlsx)
              </h3>
              <p className="text-xs text-slate-500">
                Загрузка реестра вопросов ведомства с валидацией структуры и защитой от угроз
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

        {/* Скачивание эталонного шаблона */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-800 dark:text-slate-200 block">
              Эталонный шаблон eOtinish (Excel):
            </span>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>Колонки:</span>
              <code className="text-blue-600 dark:text-blue-400 font-mono">
                Тематика / Вопрос | Суть обращения | Ключевые слова | Регламент решения
              </code>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            Скачать шаблон .xlsx
          </button>
        </div>

        {/* Зона загрузки файла Excel */}
        <div className="space-y-2">
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-850/50">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : file ? (
                <FileCheck className="w-5 h-5" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </div>

            <div className="space-y-1">
              <label className="cursor-pointer font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline inline-block">
                <span>{file ? file.name : 'Выберите файл реестра вопросов (.xlsx)'}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-[11px] text-slate-400">
                Поддерживаются исключительно таблицы Excel (.xlsx, .xls). До 5 000 строк.
              </p>
            </div>

            <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 mt-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Проверка Magic Bytes (PKZIP), MIME-типа и защита от ZIP-бомб</span>
            </div>
          </div>
        </div>

        {/* Ошибка валидации */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Превью таблицы вопросов после успешной проверки бэкендом */}
        {parsedQuestions.length > 0 && (
          <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Успешно проверено вопросов: {parsedQuestions.length}
              </span>
              {securityInfo && (
                <span className="text-[11px] text-slate-400 font-normal">
                  Размер: {Math.round((securityInfo.compressedSize || 0) / 1024)} KB (распаковано:{' '}
                  {Math.round((securityInfo.uncompressedSize || 0) / 1024)} KB)
                </span>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="p-2 w-8">#</th>
                    <th className="p-2">Тематика обращения</th>
                    <th className="p-2">Суть обращения / Описание</th>
                    <th className="p-2">Ключевые слова</th>
                    <th className="p-2">Регламент / Ответ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedQuestions.slice(0, 10).map((q, idx) => (
                    <tr key={q.id} className="text-[11px]">
                      <td className="p-2 font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-2 font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
                        {q.topic}
                      </td>
                      <td className="p-2 text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                        {q.description}
                      </td>
                      <td className="p-2 text-slate-500 truncate max-w-[130px]">
                        {q.keywords.join(', ')}
                      </td>
                      <td className="p-2 text-slate-500 truncate max-w-[150px]">
                        {q.sampleResponse || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedQuestions.length > 10 && (
              <p className="text-[10px] text-slate-400 text-right">
                И еще {parsedQuestions.length - 10} вопросов в файле
              </p>
            )}
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
            disabled={parsedQuestions.length === 0 || isLoading}
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
