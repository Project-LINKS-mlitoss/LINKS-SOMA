// src/electron.d.ts
export interface ElectronAPI {
    abr: {
      checkData: () => Promise<boolean>;
      checkDataForCode: (lgCode: string) => Promise<boolean>;
      downloadData: (abrCode: string | string[]) => Promise<{ success: boolean; message: string }>;
      downloadDataWithProgress: (abrCodes: string | string[]) => Promise<{ success: boolean; message: string }>;
      deleteData: () => Promise<{ success: boolean; message: string }>;
      onDownloadProgress: (callback: (progress: string) => void) => () => void;
      geocode: (address: string) => Promise<{
        success: boolean;
        lat?: number;
        lon?: number;
        label?: string;
        errorMessage?: string;
        score?: number;
        matchLevel?: string;
        coordinateLevel?: string;
        rsdtAddrFlg?: number;
      }>;
      geocodeBatch: (addresses: string[]) => Promise<Array<{
        success: boolean;
        lat?: number;
        lon?: number;
        label?: string;
        errorMessage?: string;
        score?: number;
        matchLevel?: string;
        coordinateLevel?: string;
        rsdtAddrFlg?: number;
      }>>;
    };
    prefectureFile: {
      save: (fileBuffer: ArrayBuffer, fileName: string) => Promise<{ success: boolean; message: string }>;
      getDefault: () => Promise<{ success: boolean; filePath?: string; fileName?: string; isBackup?: boolean; error?: string }>;
      readDefault: () => Promise<{ success: boolean; buffer?: ArrayBuffer; fileName?: string; error?: string }>;
    };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
