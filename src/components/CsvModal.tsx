import React, { useState } from 'react';
import { User, GovOrg } from '../types';
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface CsvModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onImport: (importedItems: GovOrg[]) => Promise<void>;
}

export const CsvModal: React.FC<CsvModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onImport,
}) => {
  const [csvText, setCsvText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  if (!isOpen) return null;

  const exampleCsv = `id,name,fullName,parentId,level,scope
org-mti,Минторговли,Министерство торговли и интеграции РК,org-kpm,agency,Внутренняя и внешняя торговля защита прав потребителей
org-kzpp,Комитет защиты прав потребителей,Комитет по защите прав потребителей МТИ РК,org-mti,regional,Контроль качества товаров возврат некачественной продукции`;

  const downloadTemplate = () => {
    const blob = new Blob([exampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ebz_organizations_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleParseAndImport = async () => {
    if (!csvText.trim()) {
      setMessage({ text: 'Вставьте содержимое CSV-файла', error: true });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);

      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV должен содержать заголовок и как минимум одну строку данных');
      }

      const items: GovOrg[] = [];
      // Пропускаем заголовок
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [id, name, fullName, parentId, level, scope] = line.split(',');

        if (!id || !name) {
          throw new Error(`Строка ${i + 1}: поля id и name обязательны`);
        }

        items.push({
          id: id.trim(),
          name: name.trim(),
          fullName: (fullName || name).trim(),
          parentId: parentId && parentId.trim() !== '' ? parentId.trim() : null,
          level: (level?.trim() as any) || 'agency',
          scope: (scope || '').trim(),
          questions: [],
          version: 1,
        });
      }

      await onImport(items);
      setMessage({ text: `Успешно импортировано организаций: ${items.length}` });
    } catch (err: any) {
      setMessage({ text: err.message || 'Ошибка обработки CSV', error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Шапка */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Импорт структуры (CSV)
              </h3>
              <p className="text-xs text-slate-500">
                Пакетное обновление структуры без персональных данных
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <strong>Формат колонок:</strong> <code className="text-blue-600">id, name, fullName, parentId, level, scope</code>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Скачать шаблон CSV
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
              Вставьте содержимое CSV
            </label>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={exampleCsv}
              className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                message.error
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {message.error ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 shrink-0" />
              )}
              {message.text}
            </div>
          )}

          <button
            type="button"
            onClick={handleParseAndImport}
            disabled={isSubmitting || currentUser.role !== 'superadmin'}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {isSubmitting ? 'Импорт...' : 'Импортировать в базу'}
          </button>
        </div>
      </div>
    </div>
  );
};
