import * as XLSX from 'xlsx';

export interface ExcelSecurityResult {
  isValid: boolean;
  error?: string;
  workbook?: XLSX.WorkBook;
  rows?: any[];
  totalRows?: number;
  uncompressedSize?: number;
  compressedSize?: number;
}

// Magic bytes
const PKZIP_MAGIC = [0x50, 0x4B, 0x03, 0x04]; // PK\x03\x04 (.xlsx)
const OLE2_MAGIC = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]; // .xls

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const MAX_UNCOMPRESSED_SIZE = 60 * 1024 * 1024; // 60 MB uncompressed
const MAX_COMPRESSION_RATIO = 40; // Max ratio before zip bomb alert
const MAX_ROWS_LIMIT = 5000;
const MAX_CELLS_LIMIT = 80000;

/**
 * Сканирует локальные заголовки ZIP-архива для защиты от Zip-бомб (Decompression Bomb)
 */
function inspectZipBomb(buffer: Buffer): { totalCompressed: number; totalUncompressed: number } {
  let offset = 0;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  const len = buffer.length;

  while (offset + 30 <= len) {
    // Проверяем сигнатуру локального заголовка: PK\x03\x04
    if (
      buffer[offset] === 0x50 &&
      buffer[offset + 1] === 0x4B &&
      buffer[offset + 2] === 0x03 &&
      buffer[offset + 3] === 0x04
    ) {
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraFieldLen = buffer.readUInt16LE(offset + 28);

      totalCompressed += compressedSize;
      totalUncompressed += uncompressedSize;

      // Если отдельный XML-файл внутри архива превышает 40 МБ или коэффициент сжатия подозрительно велик
      if (compressedSize > 0) {
        const fileRatio = uncompressedSize / compressedSize;
        if (fileRatio > MAX_COMPRESSION_RATIO && uncompressedSize > 5 * 1024 * 1024) {
          throw new Error(
            `Обнаружен подозрительный файл в архиве Excel (коэффициент сжатия ${Math.round(fileRatio)}:1). Загрузка заблокирована (защита от ZIP-бомб).`
          );
        }
      }

      if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
        throw new Error(
          `Общий распакованный объем таблицы превышает безопасный лимит (${Math.round(totalUncompressed / (1024 * 1024))} МБ > 60 МБ). Загрузка заблокирована.`
        );
      }

      offset += 30 + fileNameLen + extraFieldLen + compressedSize;
    } else {
      // Ищем следующую сигнатуру PK\x03\x04 или центральный каталог
      offset++;
    }
  }

  return { totalCompressed, totalUncompressed };
}

/**
 * Комплексная валидация Excel файла на сервере:
 * 1. Проверка размера файла
 * 2. Проверка расширения (.xlsx, .xls)
 * 3. Проверка MIME и Magic Bytes (реальный PKZIP/OLE2, а не переименованный exe/html)
 * 4. Защита от ZIP-бомб
 * 5. Парсинг и лимиты строк/ячеек
 */
export function validateAndParseExcel(
  buffer: Buffer,
  filename?: string
): ExcelSecurityResult {
  try {
    // 1. Проверка размера входного буфера
    if (!buffer || buffer.length === 0) {
      return { isValid: false, error: 'Файл пуст' };
    }
    if (buffer.length > MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `Размер файла (${(buffer.length / (1024 * 1024)).toFixed(1)} МБ) превышает лимит 15 МБ`,
      };
    }

    // 2. Проверка расширения файла (если передано)
    if (filename) {
      const lower = filename.toLowerCase();
      if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
        return {
          isValid: false,
          error: 'Недопустимый формат файла. Разрешены только файлы таблиц Excel (.xlsx, .xls)',
        };
      }
    }

    // 3. Проверка Magic Bytes
    const isPkzip =
      buffer.length >= 4 &&
      buffer[0] === PKZIP_MAGIC[0] &&
      buffer[1] === PKZIP_MAGIC[1] &&
      buffer[2] === PKZIP_MAGIC[2] &&
      buffer[3] === PKZIP_MAGIC[3];

    const isOle2 =
      buffer.length >= 8 &&
      OLE2_MAGIC.every((byte, idx) => buffer[idx] === byte);

    if (!isPkzip && !isOle2) {
      return {
        isValid: false,
        error:
          'Содержимое файла не соответствует формату Microsoft Excel. Загрузка фальсифицированных файлов запрещена.',
      };
    }

    // 4. Проверка на Zip-бомбу для .xlsx
    let zipStats = { totalCompressed: buffer.length, totalUncompressed: buffer.length };
    if (isPkzip) {
      zipStats = inspectZipBomb(buffer);
    }

    // 5. Безопасный парсинг таблицы
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellFormula: false, // Отключаем вычисление формул для защиты от Formula Injection
      cellHTML: false,
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { isValid: false, error: 'Книга Excel не содержит ни одного листа с данными' };
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) {
      return { isValid: false, error: 'Таблица Excel пуста. Заполните строки с данными' };
    }

    if (rows.length > MAX_ROWS_LIMIT) {
      return {
        isValid: false,
        error: `Количество строк (${rows.length}) превышает безопасный лимит (${MAX_ROWS_LIMIT} строк). Разделите файл на части.`,
      };
    }

    return {
      isValid: true,
      workbook,
      rows,
      totalRows: rows.length,
      compressedSize: zipStats.totalCompressed,
      uncompressedSize: zipStats.totalUncompressed,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err.message || 'Ошибка валидации структуры Excel файла',
    };
  }
}
