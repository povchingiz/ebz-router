'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  ShieldCheck,
  Building2,
  Table,
} from 'lucide-react';

interface BulkExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  selectedBranchId?: string | null;
}

export const BulkExcelModal: React.FC<BulkExcelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedBranchId,
}) => {
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    totalRows: number;
    processed: number;
    errorsCount: number;
    errors: { row: number; org_id: any; error: string }[];
    dryRun: boolean;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('Размер файла превышает лимит 20 МБ');
      return;
    }

    setFileName(file.name);
    setErrorMessage(null);
    setSuccessMessage(null);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('Файл Excel не содержит листов');
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (jsonRows.length === 0) {
          throw new Error('Таблица пуста. Заполните строки по шаблону');
        }
        setParsedRows(jsonRows);
      } catch (err: any) {
        setErrorMessage(err.message || 'Ошибка чтения файла Excel (.xlsx)');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Ошибка чтения файла с диска');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleValidate = async () => {
    if (parsedRows.length === 0) {
      setErrorMessage('Загрузите файл Excel (.xlsx) перед запуском проверки');
      return;
    }

    setIsValidating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (parsedRows.length > 5000) {
        throw new Error('Файл содержит более 5000 строк. Разделите импорт на части.');
      }

      const res = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows, dryRun: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка проверки данных');
      }

      setValidationResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка валидации структуры');
    } finally {
      setIsValidating(false);
    }
  };

  const handleApply = async () => {
    if (parsedRows.length === 0) return;

    setIsApplying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows, dryRun: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка применения данных');
      }

      setSuccessMessage(
        `Успешно обновлено ведомств: ${data.processed}. Все изменения применены в базе и записаны в аудит-лог.`
      );
      setValidationResult(null);
      await onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка применения изменений');
    } finally {
      setIsApplying(false);
    }
  };

  const downloadTemplateUrl = `/api/bulk${selectedBranchId ? `?branch_id=${selectedBranchId}` : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Шапка модального окна */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Реестр госорганов (Excel)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Пакетное обновление
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Массовая выгрузка и обновление карточек государственных органов и их полномочий
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело модального окна */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Разъясняющий баннер */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Назначение данного файла:</span> Настоящий шаблон содержит перечень госорганов (наименования, локации, сферы ведения, анти-компетенции и контакты).
                <div className="mt-1 text-[11px] text-blue-700 dark:text-blue-300 opacity-90">
                  База частых вопросов и типовых обращений (FAQ) заполняется отдельно внутри карточки каждого конкретного ведомства (вкладка «Вопросы и темы»).
                </div>
              </div>
            </div>
          </div>

          {/* Блок скачивания шаблона Excel */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Официальный шаблон Excel (.xlsx) с русскими заголовками</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                Генерируется как стандартный рабочий файл Excel (.xlsx) с форматированными колонками и сопоставлением с базой данных.
              </p>
            </div>
            <a
              href={downloadTemplateUrl}
              download="reestr_gosorganov.xlsx"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all shrink-0 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Скачать реестр (.xlsx)</span>
            </a>
          </div>

          {/* Загрузка файла Excel */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Загрузите заполненный файл Excel (.xlsx):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-2 border-slate-200 dark:border-slate-700 transition-all shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>{fileName || 'Выбрать файл .xlsx'}</span>
                </button>
              </div>
            </div>

            {/* Предпросмотр загруженных строк */}
            {parsedRows.length > 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                    <Table className="w-4 h-4 text-emerald-600" />
                    <span>Файл прочитан: {fileName}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black">
                      Строк: {parsedRows.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setFileName(null);
                      setValidationResult(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    Очистить
                  </button>
                </div>

                {/* Таблица первых 5 строк */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-150 dark:bg-slate-800 text-slate-500 uppercase font-black tracking-wider text-[10px] sticky top-0">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">ID организации</th>
                        <th className="p-2">Краткое наименование</th>
                        <th className="p-2">Полное наименование</th>
                        <th className="p-2">Сфера ведения</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {parsedRows.slice(0, 5).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                          <td className="p-2 text-slate-400">{idx + 1}</td>
                          <td className="p-2 font-bold text-slate-800 dark:text-slate-200">
                            {r['ID организации'] || r.org_id || '—'}
                          </td>
                          <td className="p-2 font-bold text-blue-600 dark:text-blue-400">
                            {r['Краткое наименование (RU)'] || r.short_name_ru || '—'}
                          </td>
                          <td className="p-2 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                            {r['Полное официальное наименование (RU)'] || r.org_name_ru || '—'}
                          </td>
                          <td className="p-2 text-slate-500 max-w-[200px] truncate">
                            {r['Полномочия (Что входит)'] || r.scope || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 5 && (
                  <p className="text-[10px] text-slate-400 text-right">
                    И еще {parsedRows.length - 5} строк...
                  </p>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-950 flex flex-col items-center justify-center gap-2 group"
              >
                <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 group-hover:scale-105 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Нажмите для выбора файла Excel (.xlsx)
                </div>
                <div className="text-[11px] text-slate-400">
                  Поддерживаются файлы Microsoft Excel (.xlsx, .xls) до 20 МБ
                </div>
              </div>
            )}
          </div>

          {/* Сообщения об ошибках или успехе */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Результаты валидации (Dry Run) */}
          {validationResult && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Результаты предварительной проверки (Dry Run)
                  </span>
                </div>
                <div className="text-xs font-bold">
                  {validationResult.errorsCount === 0 ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Все {validationResult.totalRows} строк корректны и готовы к записи
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> Найдено ошибок: {validationResult.errorsCount} из {validationResult.totalRows}
                    </span>
                  )}
                </div>
              </div>

              {validationResult.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-2 text-[11px] divide-y divide-rose-100 dark:divide-rose-950">
                  {validationResult.errors.map((err, idx) => (
                    <div key={idx} className="py-1 px-2 text-rose-700 dark:text-rose-300 flex items-center justify-between">
                      <span>Строка {err.row} (ID: {String(err.org_id || 'пусто')}): {err.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Подвал с действиями */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Защита от Formula Injection и проверка прав</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all"
            >
              Закрыть
            </button>

            <button
              type="button"
              onClick={handleValidate}
              disabled={isValidating || isApplying || parsedRows.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all disabled:opacity-40"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
              <span>Проверить данные (Dry Run)</span>
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || isValidating || parsedRows.length === 0 || (validationResult !== null && validationResult.errorsCount > 0)}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all disabled:opacity-40"
            >
              {isApplying ? 'Применение изменений...' : 'Применить изменения'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
