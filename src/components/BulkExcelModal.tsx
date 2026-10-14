import React, { useState, useRef } from 'react';
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
  FileText,
  ArrowRight,
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
  const [csvContent, setCsvContent] = useState('');
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

  // Парсинг CSV с поддержкой разделителей (точка с запятой или запятая) и кавычек
  const parseCsvToObjects = (text: string): any[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('Таблица должна содержать заголовок и как минимум одну строку с данными');
    }

    // Определяем разделитель по первой строке
    const delimiter = lines[0].includes(';') ? ';' : ',';

    const parseLine = (line: string): string[] => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++; // Пропускаем сдвоенную кавычку
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseLine(line).map((v) => v.replace(/^"|"$/g, '').trim());
      const rowObj: Record<string, string> = {};
      headers.forEach((header, idx) => {
        rowObj[header] = values[idx] || '';
      });
      rows.push(rowObj);
    }

    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Размер файла превышает лимит 10 МБ');
      return;
    }

    setFileName(file.name);
    setErrorMessage(null);
    setSuccessMessage(null);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.onerror = () => {
      setErrorMessage('Ошибка чтения файла');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleValidate = async () => {
    if (!csvContent.trim()) {
      setErrorMessage('Вставьте данные или выберите файл CSV/Excel');
      return;
    }

    setIsValidating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const rows = parseCsvToObjects(csvContent);
      if (rows.length > 5000) {
        throw new Error('Файл содержит более 5000 строк. Разделите импорт на части.');
      }

      const res = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, dryRun: true }),
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
    if (!csvContent.trim()) return;

    setIsApplying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const rows = parseCsvToObjects(csvContent);
      const res = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, dryRun: false }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка применения данных');
      }

      setSuccessMessage(
        `Успешно обновлено организаций: ${data.processed}. Все изменения зафиксированы в аудит-логе.`
      );
      setValidationResult(null);
      await onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ошибка применения изменений');
    } finally {
      setIsApplying(false);
    }
  };

  const downloadTemplateUrl = `/api/bulk${selectedBranchId ? `?branch_id=${selectedBranchId}` : '?limit=20'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Шапка */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Пакетная работа через Excel / CSV
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Безопасный импорт
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Выгрузка, массовое редактирование и безопасная загрузка с защитой от инъекций формул
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

        {/* Тело */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Блок скачивания шаблона */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Готовый шаблон с русскими названиями колонок</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                Файл содержит правильный формат UTF-8 BOM, открывается в Microsoft Excel без искажения символов.
              </p>
            </div>
            <a
              href={downloadTemplateUrl}
              download
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100/60 shadow-xs transition-all shrink-0 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Скачать шаблон Excel</span>
            </a>
          </div>

          {/* Загрузка файла или вставка текста */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Загрузите файл или вставьте содержимое таблицы:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{fileName || 'Выбрать файл .csv'}</span>
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value);
                setValidationResult(null);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              placeholder={`"ID организации";"Краткое наименование (RU)";"Полное официальное наименование (RU)";"Полномочия (Что входит)";"Анти-компетенции (Что НЕ входит)";"Куда перенаправлять ошибки";"Телефон канцелярии";"Отображать онлайн (Да/Нет)"\r\n"17862";"Минэнерго РК";"Министерство энергетики Республики Казахстан";"Электроэнергетика добыча нефти";"Не расследует монопольный сговор цен на АЗС";"Обращаться в АЗРК РК";"+7 (7172) 78-68-00";"Да"`}
              className="w-full p-3 font-mono text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 focus:ring-2 focus:ring-emerald-500 outline-none leading-relaxed"
            />
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
                      <CheckCircle2 className="w-4 h-4" /> Все {validationResult.totalRows} строк корректны
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
            <span>Включена защита от Formula Injection и проверка каскадных прав</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all"
            >
              Отмена
            </button>

            {!validationResult || validationResult.errorsCount > 0 ? (
              <button
                type="button"
                onClick={handleValidate}
                disabled={isValidating || !csvContent.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-md active:scale-95 transition-all"
              >
                {isValidating ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Проверка...</span>
                  </>
                ) : (
                  <>
                    <span>1. Проверить данные</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-md active:scale-95 transition-all animate-pulse"
              >
                {isApplying ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Применение в БД...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>2. Применить {validationResult.processed} записей</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
