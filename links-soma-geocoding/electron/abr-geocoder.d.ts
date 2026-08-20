// Type shim for @digital-go-jp/abr-geocoder which ships no .d.ts.
// We declare only the surface we touch from electron/main.ts.

declare module '@digital-go-jp/abr-geocoder/build/index' {
  import { Duplex } from 'stream';
  export const DEFAULT_FUZZY_CHAR: string;

  /** common.sqlite の city テーブル1行。county / ward は該当しない自治体では空文字。 */
  export interface AbrCityRow {
    lg_code: string;
    county: string;
    city: string;
    ward: string;
    pref: string;
  }

  export class AbrGeocoderDiContainer {
    constructor(params: {
      database: { type: 'sqlite3'; dataDir: string };
      cacheDir: string;
      debug?: boolean;
    });
    readonly database: {
      openCommonDb(): Promise<{
        getCityList(): Promise<AbrCityRow[]>;
        close(): Promise<void>;
      }>;
    };
  }

  export class AbrGeocoder {
    static create(params: {
      container: AbrGeocoderDiContainer;
      numOfThreads: number;
      isSilentMode?: boolean;
      signal?: AbortSignal;
    }): Promise<AbrGeocoder>;
    close(): Promise<void>;
  }

  export class AbrGeocoderStream extends Duplex {
    constructor(params: {
      geocoder: AbrGeocoder;
      fuzzy?: string;
      searchTarget?: string;
      highWatermark?: number;
    });
  }

  export const SearchTarget: {
    readonly ALL: string;
    readonly RESIDENTIAL: string;
    readonly PARCEL: string;
  };

  export const OutputFormat: {
    readonly CSV: string;
    readonly JSON: string;
    readonly NDJSON: string;
    readonly GEOJSON: string;
    readonly NDGEOJSON: string;
    readonly SIMPLIFIED: string;
  };

  export const FormatterProvider: {
    get(params: { type: string; debug?: boolean }): NodeJS.ReadWriteStream;
  };
}

declare module '@digital-go-jp/abr-geocoder/build/usecases/download/download-process';
declare module '@digital-go-jp/abr-geocoder/build/usecases/geocode/services/create-geocode-caches';
