import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface Prefecture {
  prefecture: string;
  prefectureCode: string;
  cities: Array<{ name: string; lgCode: string }>;
}

/**
 * Parse Excel/CSV file to extract prefecture and city data
 * Expected format:
 * - Column 1: lgCode (6 digits)
 * - Column 2: Prefecture name
 * - Column 3: City name (optional, if exists then it's a city row)
 * - Column 4+: Other data (ignored)
 * 
 * If only 2 columns exist, it's a prefecture-only row
 * If 3+ columns exist, it's a city row
 */
export function parsePrefectureFile(file: File): Promise<Prefecture[]> {
  return new Promise((resolve, reject) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      parseCSV(file, resolve, reject);
    } else if (fileExtension === 'xls' || fileExtension === 'xlsx') {
      parseExcel(file, resolve, reject);
    } else {
      reject(new Error('Unsupported file format. Please use CSV, XLS, or XLSX files.'));
    }
  });
}

function parseCSV(
  file: File,
  resolve: (data: Prefecture[]) => void,
  reject: (error: Error) => void
) {
  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: (results) => {
      try {
        const prefectures = processRows(results.data as string[][]);
        resolve(prefectures);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse CSV file'));
      }
    },
    error: (error) => {
      reject(new Error(`CSV parsing error: ${error.message}`));
    },
  });
}

function parseExcel(
  file: File,
  resolve: (data: Prefecture[]) => void,
  reject: (error: Error) => void
) {
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const data = e.target?.result;
      if (!data) {
        reject(new Error('Failed to read file'));
        return;
      }
      
      const workbook = XLSX.read(data, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON array
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as string[][];
      
      const prefectures = processRows(rows);
      resolve(prefectures);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(`Failed to parse Excel file: ${String(error)}`));
    }
  };
  
  reader.onerror = () => {
    reject(new Error('Failed to read file'));
  };
  
  reader.readAsBinaryString(file);
}

function processRows(rows: string[][]): Prefecture[] {
  const prefectureMap = new Map<string, Prefecture>();
  
  for (const row of rows) {
    // Skip empty rows
    if (!row || row.length < 2 || !row[0] || !row[1]) {
      continue;
    }
    
    const lgCode = String(row[0]).trim();
    const prefectureName = String(row[1]).trim();
    const cityName = row[2] ? String(row[2]).trim() : '';
    
    // Validate lgCode format (should be 6 digits)
    if (!/^\d{6}$/.test(lgCode)) {
      continue;
    }
    
    // Extract prefecture code (first 2 digits)
    const prefectureCode = lgCode.substring(0, 2);
    
    if (!prefectureName) {
      continue;
    }
    
    // Get or create prefecture
    let prefecture = prefectureMap.get(prefectureName);
    if (!prefecture) {
      prefecture = {
        prefecture: prefectureName,
        prefectureCode: prefectureCode.padStart(6, '0'), // Use 6-digit format for consistency
        cities: [],
      };
      prefectureMap.set(prefectureName, prefecture);
    }
    
    // If city name exists, add it as a city
    if (cityName) {
      // Check if city already exists
      const cityExists = prefecture.cities.some(c => c.lgCode === lgCode);
      if (!cityExists) {
        prefecture.cities.push({
          lgCode,
          name: cityName,
        });
      }
    }
  }
  
  // Sort cities by lgCode
  for (const prefecture of prefectureMap.values()) {
    prefecture.cities.sort((a, b) => a.lgCode.localeCompare(b.lgCode));
  }
  
  // Convert map to array and sort by prefecture code
  return Array.from(prefectureMap.values()).sort((a, b) => 
    a.prefectureCode.localeCompare(b.prefectureCode)
  );
}
