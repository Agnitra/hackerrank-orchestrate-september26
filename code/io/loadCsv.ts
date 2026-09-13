import * as fs from 'fs';
import * as path from 'path';
import { FinancialProfile } from '../types';

export const BASE_DIR = resolveBaseDir();

function resolveBaseDir(): string {
  const possiblePaths = [
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..'),
    process.cwd(),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'dataset'))) return p;
  }
  return process.cwd();
}

export function readCsv(filePath: string): string[][] {
  const fullPath = filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)
    ? filePath
    : path.join(BASE_DIR, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.trim().split(/\r?\n/);
  return lines.map(line => parseCsvLine(line));
}

export function readCsvAsObjects<T>(filePath: string, headers: (keyof T)[]): T[] {
  const rows = readCsv(filePath);
  if (rows.length < 2) return [];
  const headersRow = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headersRow.forEach((h, i) => {
      obj[h] = row[i] !== undefined ? row[i].trim() : '';
    });
    return obj as unknown as T;
  });
}

export function resolveDatasetPath(relativePath: string): string {
  return path.join(BASE_DIR, 'dataset', relativePath);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}