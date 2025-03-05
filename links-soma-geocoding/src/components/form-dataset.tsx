import { useRef, useState } from 'react';
import {
  Button,
  Card,
  makeStyles,
  mergeClasses,
  Option,
  tokens,
} from '@fluentui/react-components';
import { useFormContext } from 'react-hook-form';
import { Dropdown } from './ui/dropdown';
import { Field } from './ui/field';
import Papa from 'papaparse';
import fileUploadIcon from '../../public/image/file-upload-icon.svg';

const useStyles = makeStyles({
  fileSelectorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '200px',
    height: '160px',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: '5px',
    cursor: 'pointer',
    backgroundColor: tokens.colorNeutralBackground3,
    gap: `${tokens.spacingVerticalS} 0`,
  },
  bold: {
    margin: 0,
    fontWeight: tokens.fontWeightBold,
  },
  fieldContainer: {
    display: 'flex',
    gap: '24px',
  },
  dropdownContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridAutoRows: '60px',
    gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  dropdown: {
    height: '36px',
    width: '400px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  input: {
    display: 'none',
  },
  fileContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  fileName: {
    fontWeight: tokens.fontWeightSemibold,
  },
  inputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingHorizontalM,
  },
});

export const FormDataset = (): JSX.Element => {
  const styles = useStyles();
  const { setValue, watch } = useFormContext();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  const handleFileSelectorClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setValue('datasetPaths', [file.name]);
      setSelectedFileName(file.name);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: results => {
          if (results.meta && results.meta.fields) {
            setCsvColumns(results.meta.fields);
          }
          // CSV全データをformに保存
          // results.dataは以下のようなオブジェクトの配列：
          // [ { ID: "1", 名称: "東京駅", 住所: "東京都千代田区丸の内1-1", 備考:"..." }, {...}, ... ]
          setValue('csvData', results.data);
        },
        error: error => {
          console.error('CSV parsing error:', error);
        },
      });
    }
  };

  const handleDeleteFile = () => {
    setValue('datasetPaths', []);
    setValue('csvData', []);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedFileName('');
    setCsvColumns([]);
  };

  const datasetPaths = watch('datasetPaths', []);

  const columnLabels = ['住所に対応するカラムを選択'];

  return (
    <Card>
      <p className={styles.bold}>ジオコーディング用データ</p>
      <div className={styles.fieldContainer}>
        <div
          className={styles.fileSelectorContainer}
          role="button"
          onClick={handleFileSelectorClick}
        >
          <DataSetImportSymbol />
          <input
            ref={fileInputRef}
            className={styles.input}
            type="file"
            accept=".csv"
            placeholder="ファイルを選択"
            onChange={handleFileChange}
          />
        </div>
        <div className={styles.inputWrapper}>
          {datasetPaths && datasetPaths.length > 0 ? (
            <div className={styles.fileContainer}>
              <div className={styles.fileName}>{selectedFileName}</div>
              <Button onClick={handleDeleteFile}>削除</Button>
            </div>
          ) : (
            <div className={styles.fileContainer}>
              <div className={styles.fileName}>
                ファイルが選択されていません
              </div>
            </div>
          )}

          <div className={mergeClasses(styles.dropdownContainer)}>
            {columnLabels.map((label, index) => (
              <Field key={index} className={styles.field} label={label}>
                <Dropdown
                  className={styles.dropdown}
                  disabled={!csvColumns.length}
                  onOptionSelect={(_, data) => {
                    setValue(`columns.${label}`, data.optionValue);
                  }}
                  selectedOptions={[watch(`columns.${label}`) || '']}
                  value={watch(`columns.${label}`) || ''}
                  placeholder="選択してください"
                >
                  {csvColumns.map(columnName => (
                    <Option key={columnName} value={columnName}>
                      {columnName}
                    </Option>
                  ))}
                </Dropdown>
              </Field>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

const useDataSetImporterSymbolStyle = makeStyles({
  roundedLabel: {
    backgroundColor: '#6264A7',
    borderRadius: '14px',
    color: '#fff',
    fontWeight: tokens.fontWeightBold,
    lineHeight: '28px',
    padding: `0 ${tokens.spacingHorizontalXXL}`,
  },
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: `${tokens.spacingVerticalS} 0`,
  },
});

const DataSetImportSymbol = (): JSX.Element => {
  const styles = useDataSetImporterSymbolStyle();

  return (
    <div className={styles.root}>
      <img alt="upload file" src={fileUploadIcon} />
      <div className={styles.roundedLabel}>データを選択</div>
    </div>
  );
};
