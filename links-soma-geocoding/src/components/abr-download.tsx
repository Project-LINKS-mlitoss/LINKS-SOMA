import { useState, useEffect, useRef } from 'react';
import {
  makeStyles,
  tokens,
  Card,
  Button,
  Spinner,
  Field,
  Option,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
} from '@fluentui/react-components';
import { Dropdown } from './ui/dropdown';
import { parsePrefectureFile, Prefecture } from '../utils/parse-prefecture-file';

const useStyles = makeStyles({
  title: {
    fontWeight: tokens.fontWeightBold,
    marginBottom: tokens.spacingVerticalM,
  },
  dropdownRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
    alignItems: 'flex-end',
  },
  dropdown: {
    flex: 1,
    minHeight: '32px',
    '& button': {
      minHeight: '32px',
      height: '32px',
    },
  },
  buttonWrapper: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
  },
  fileUploadSection: {
    marginBottom: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  fileUploadArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    alignItems: 'flex-start',
  },
  fileInput: {
    display: 'none',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  fileActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  fileUploadLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXS,
  },
  message: {
    marginTop: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  error: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground2,
  },
  success: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground2,
  },
});

export const AbrDownload = (): JSX.Element => {
  const styles = useStyles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prefectures, setPrefectures] = useState<Prefecture[]>([]);
  const [selectedPrefecture, setSelectedPrefecture] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedLgCode, setSelectedLgCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [dataExists, setDataExists] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Load default file on mount
  useEffect(() => {
    loadDefaultFile();
  }, []);

  const loadDefaultFile = async () => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return;
    }

    try {
      const result = await window.electronAPI.prefectureFile.readDefault();
      if (result.success && result.buffer && result.fileName) {
        // Convert ArrayBuffer to Blob
        const blob = new Blob([result.buffer], { 
          type: result.fileName.endsWith('.xls') ? 'application/vnd.ms-excel' :
                result.fileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                'text/csv'
        });
        const file = new File([blob], result.fileName, { 
          type: blob.type 
        });
        await handleFileLoad(file, false, true); // Load without saving, silently
      }
    } catch (error) {
      console.error('Failed to load default file:', error);
      // Silently fail - user can upload file manually
    }
  };

  const handleFileLoad = async (file: File, shouldSave: boolean = true, silent: boolean = false) => {
    setIsLoading(true);
    if (!silent) {
      setMessage(null);
    }
    
    try {
      // Save file to system first if shouldSave is true
      // This ensures the file is saved before parsing, so reload will get the latest data
      if (shouldSave && typeof window !== 'undefined' && window.electronAPI) {
        const arrayBuffer = await file.arrayBuffer();
        const saveResult = await window.electronAPI.prefectureFile.save(arrayBuffer, file.name);
        if (!saveResult.success) {
          console.error('[Pref] Save failed:', saveResult.message);
          setMessage({ 
            type: 'error', 
            text: `ファイルの保存に失敗しました: ${saveResult.message}` 
          });
          setIsLoading(false);
          return;
        }
        
        // Add a small delay to ensure file is fully written to disk
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // After saving, reload the file from disk to ensure we have the latest data
        // This is important when uploading a file with the same name
        const reloadResult = await window.electronAPI.prefectureFile.readDefault();
        if (reloadResult.success && reloadResult.buffer && reloadResult.fileName) {
          // Convert ArrayBuffer to Blob and File
          const reloadBlob = new Blob([reloadResult.buffer], { 
            type: reloadResult.fileName.endsWith('.xls') ? 'application/vnd.ms-excel' :
                  reloadResult.fileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                  'text/csv'
          });
          const reloadFile = new File([reloadBlob], reloadResult.fileName, { 
            type: reloadBlob.type 
          });
          
          // Parse the reloaded file to get fresh data
          const reloadedData = await parsePrefectureFile(reloadFile);
          setPrefectures(reloadedData);
          setUploadedFileName(reloadResult.fileName);
          
          setMessage({ 
            type: 'success', 
            text: `ファイル「${reloadResult.fileName}」を読み込み、システムに保存しました (${reloadedData.length}都道府県)` 
          });
        } else {
          // Fallback: parse the uploaded file if reload fails
          const parsedData = await parsePrefectureFile(file);
          setPrefectures(parsedData);
          setUploadedFileName(file.name);
          setMessage({ 
            type: 'success', 
            text: `ファイル「${file.name}」を読み込み、システムに保存しました (${parsedData.length}都道府県)` 
          });
        }
      } else {
        // If not saving, just parse the file
        const parsedData = await parsePrefectureFile(file);
        setPrefectures(parsedData);
        setUploadedFileName(file.name);
        
        if (!silent) {
          // Only show message if not silent (i.e., when user uploads)
          setMessage({ type: 'success', text: `ファイル「${file.name}」を読み込みました (${parsedData.length}都道府県)` });
        }
      }
      
      // Reset selections when new file is loaded
      setSelectedPrefecture('');
      setSelectedCity('');
      setSelectedLgCode('');
      setDataExists(false);
    } catch (error) {
      console.error('Failed to parse file:', error);
      if (!silent) {
        setMessage({ 
          type: 'error', 
          text: `ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` 
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    await handleFileLoad(file, true); // Save to system
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      console.log('[Pref] File selected:', selectedFile.name, 'Size:', selectedFile.size, 'bytes');
      handleFileUpload(selectedFile);
      // Reset file input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadCurrentFile = async () => {
    if (typeof window === 'undefined' || !window.electronAPI) {
      setMessage({ type: 'error', text: 'Electron環境が必要です' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const result = await window.electronAPI.prefectureFile.readDefault();
      
      if (!result.success || !result.buffer || !result.fileName) {
        setMessage({ type: 'error', text: result.error || 'ダウンロードするファイルがありません' });
        setIsLoading(false);
        return;
      }

      // Convert ArrayBuffer to Blob
      const blob = new Blob([result.buffer], { 
        type: result.fileName.endsWith('.xls') ? 'application/vnd.ms-excel' :
              result.fileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
              'text/csv'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: `ファイル「${result.fileName}」をダウンロードしました` });
    } catch (error) {
      console.error('Failed to download file:', error);
      setMessage({ 
        type: 'error', 
        text: `ファイルのダウンロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset city selection and clear message when prefecture changes
  useEffect(() => {
    setSelectedCity('');
    setSelectedLgCode('');
    setDataExists(false);
    setProgress('');
    setMessage(null); // Clear message when prefecture changes
  }, [selectedPrefecture]);

  // Check if data exists when city is selected, and clear message
  useEffect(() => {
    setMessage(null); // Clear message when city selection changes
    const checkData = async () => {
      if (selectedLgCode && typeof window !== 'undefined' && window.electronAPI) {
        try {
          const exists = await window.electronAPI.abr.checkDataForCode(selectedLgCode);
          setDataExists(exists);
        } catch (error) {
          console.error('Failed to check data:', error);
          setDataExists(false);
        }
      } else {
        setDataExists(false);
      }
    };
    checkData();
  }, [selectedLgCode]);

  const selectedPrefectureData = prefectures.find(
    (p) => p.prefecture === selectedPrefecture
  );

  const handleDownload = async () => {
    if (!selectedPrefecture) {
      setMessage({ type: 'error', text: '都道府県を選択してください' });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setProgress('');

    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Determine which codes to download
        let codesToDownload: string[] = [];
        
        if (selectedLgCode) {
          // Download selected city only
          codesToDownload = [selectedLgCode];
        } else if (selectedPrefectureData) {
          // Download all cities in the prefecture
          codesToDownload = selectedPrefectureData.cities.map(city => city.lgCode);
        }

        if (codesToDownload.length === 0) {
          setMessage({ type: 'error', text: 'ダウンロードするデータがありません' });
          setIsLoading(false);
          return;
        }

        // Set up progress listener
        const removeListener = window.electronAPI.abr.onDownloadProgress((progressText) => {
          setProgress((prev) => prev + progressText);
        });

        try {
          // Check if data already exists before downloading
          if (selectedLgCode) {
            // Check single city
            const exists = await window.electronAPI.abr.checkDataForCode(selectedLgCode);
            if (exists) {
              setMessage({ type: 'error', text: `${selectedCity}のデータは既にダウンロード済みです` });
              setIsLoading(false);
              removeListener();
              return;
            }
          } else if (selectedPrefectureData) {
            // Check all cities - if all exist, skip download
            const allExist = await Promise.all(
              codesToDownload.map(code => window.electronAPI.abr.checkDataForCode(code))
            );
            if (allExist.every(exists => exists)) {
              setMessage({ type: 'error', text: `${selectedPrefecture}の全市区町村のデータは既にダウンロード済みです` });
              setIsLoading(false);
              removeListener();
              return;
            }
            // Filter out codes that already exist
            const existingChecks = await Promise.all(
              codesToDownload.map(async (code) => ({
                code,
                exists: await window.electronAPI.abr.checkDataForCode(code)
              }))
            );
            codesToDownload = existingChecks
              .filter(check => !check.exists)
              .map(check => check.code);
            
            if (codesToDownload.length === 0) {
              setMessage({ type: 'error', text: `${selectedPrefecture}の全市区町村のデータは既にダウンロード済みです` });
              setIsLoading(false);
              removeListener();
              return;
            }
          }

          const result = await window.electronAPI.abr.downloadDataWithProgress(codesToDownload);
          
          if (result.success) {
            const downloadText = selectedCity 
              ? `${selectedPrefecture} ${selectedCity}`
              : `${selectedPrefecture} の${codesToDownload.length}市区町村`;
            setMessage({ type: 'success', text: `ダウンロードが完了しました: ${downloadText}` });
            // Re-check data existence after download
            if (selectedLgCode) {
              const exists = await window.electronAPI.abr.checkDataForCode(selectedLgCode);
              setDataExists(exists);
            }
            setProgress('');
          } else {
            setMessage({ type: 'error', text: `ダウンロードに失敗しました: ${result.message || '不明なエラー'}` });
          }
        } finally {
          removeListener();
        }
      } else {
        setMessage({ type: 'error', text: 'Electron環境が必要です' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `ダウンロードに失敗しました: ${error.message || '不明なエラー'}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDataClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteDialog(false);
    setIsLoading(true);
    setMessage(null);
    setProgress('');

    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.abr.deleteData();
        
        if (result.success) {
          setMessage({ type: 'success', text: result.message || 'データが削除されました' });
          setDataExists(false);
          // Reset selections after deletion
          setSelectedPrefecture('');
          setSelectedCity('');
          setSelectedLgCode('');
        } else {
          setMessage({ type: 'error', text: `削除に失敗しました: ${result.message}` });
        }
      } else {
        setMessage({ type: 'error', text: 'Electron環境が必要です' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `エラー: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <div className={styles.title}>ABRデータダウンロード</div>
      
      <div className={styles.fileUploadSection}>
        <div className={styles.fileUploadArea}>
          <div className={styles.fileUploadLabel}>市区町村一覧ファイル</div>
          {uploadedFileName && (
            <div className={styles.fileInfo}>
              <span>読み込み済み: {uploadedFileName}</span>
            </div>
          )}
          <div className={styles.fileActions}>
            <Button
              appearance="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              ファイルを変更
            </Button>
            <Button
              appearance="secondary"
              onClick={handleDownloadCurrentFile}
              disabled={isLoading}
            >
              現在のファイルを保存
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleFileSelect}
            className={styles.fileInput}
          />
        </div>
      </div>
      
      <div className={styles.dropdownRow}>
        <Field label="都道府県を選択" style={{ flex: 1 }}>
          <Dropdown
            className={styles.dropdown}
            placeholder={prefectures.length === 0 ? "ファイルをアップロードしてください" : "都道府県を選択してください"}
            disabled={prefectures.length === 0 || isLoading}
            selectedOptions={selectedPrefecture ? [selectedPrefecture] : []}
            value={selectedPrefecture}
            clearable={Boolean(selectedPrefecture)}
            onOptionSelect={(_, data) => {
              if (data.optionValue) {
                setSelectedPrefecture(data.optionValue);
                setMessage(null); // Clear message on prefecture change
              } else {
                setSelectedPrefecture('');
                setSelectedCity('');
                setSelectedLgCode('');
                setDataExists(false);
                setMessage(null); // Clear message on clear
              }
            }}
          >
            {prefectures.map((pref) => (
              <Option key={pref.prefectureCode} value={pref.prefecture}>
                {pref.prefecture}
              </Option>
            ))}
          </Dropdown>
        </Field>

        <Field label="市区町村を選択" style={{ flex: 1 }}>
          <Dropdown
            className={styles.dropdown}
            placeholder="市区町村を選択してください（未選択で全件）"
            disabled={!selectedPrefecture || isLoading}
            selectedOptions={selectedCity ? [selectedCity] : []}
            value={selectedCity}
            clearable={Boolean(selectedCity)}
            onOptionSelect={(_, data) => {
              if (data.optionValue && selectedPrefectureData) {
                const city = selectedPrefectureData.cities.find(
                  (c) => c.name === data.optionValue
                );
                setSelectedCity(data.optionValue);
                setSelectedLgCode(city?.lgCode || '');
                setMessage(null); // Clear message on city change
              } else {
                // Clear selection
                setSelectedCity('');
                setSelectedLgCode('');
                setDataExists(false);
                setMessage(null); // Clear message on clear
              }
            }}
          >
            {selectedPrefectureData?.cities.map((city) => (
              <Option key={city.lgCode} value={city.name}>
                {city.name}
              </Option>
            )) || []}
          </Dropdown>
        </Field>
      </div>

      <div className={styles.buttonWrapper}>
        <Button
          appearance="primary"
          onClick={handleDownload}
          disabled={isLoading || !selectedPrefecture || (Boolean(selectedLgCode) && dataExists)}
        >
          {isLoading ? <Spinner size="tiny" /> : 'ダウンロード'}
        </Button>
        <Button
          appearance="secondary"
          onClick={handleDeleteDataClick}
          disabled={isLoading}
        >
          すべてのデータを削除
        </Button>
      </div>

      {dataExists && selectedLgCode && selectedCity && (
        <div className={`${styles.message} ${styles.success}`}>
          {selectedCity}のデータは既にダウンロード済みです。
        </div>
      )}

      {isLoading && progress && (
        <div className={styles.message}>
          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' }}>
            {progress}
          </div>
        </div>
      )}

      {message && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      <Dialog open={showDeleteDialog} onOpenChange={(_, data) => setShowDeleteDialog(Boolean(data.open))}>
        <DialogSurface>
          <DialogTitle>データ削除の確認</DialogTitle>
          <DialogBody>
            <DialogContent>
              すべてのABRデータを削除しますか？この操作は元に戻せません。
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setShowDeleteDialog(false)}>
                キャンセル
              </Button>
              <Button appearance="primary" onClick={handleDeleteConfirm}>
                削除
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Card>
  );
};
