import { type ipcMain } from "electron";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import { _debugInsertModelFiles } from "../pages/debug/ipc-main-listeners/_debug-insert-model-files";
import { _debugInsertJobs } from "../pages/debug/ipc-main-listeners/_debug-insert-jobs";
import { _debugCreateJob } from "../pages/debug/ipc-main-listeners/_debug-create-job";
import { _debugCreateWorkshopData } from "../pages/debug/ipc-main-listeners/_debug-create-workshop-data";
import { createDataSetResults } from "../pages/debug/ipc-main-listeners/_create-data-set-results";
import { createDummyDataSetResults } from "../pages/debug/ipc-main-listeners/_create-dummy-data-set-results";
import { selectBuildingsInBatches } from "./select-buildings-in-batches";
import { selectAreasInBatches } from "./select-areas-in-batches";
import { selectReferenceDates } from "./select-reference-dates";
import { helloFromPython } from "./hello-from-python";
import { saveNameFromPython } from "./save-name-from-python";
import { createWorkbooks } from "./create-workbooks";
import { selectWorkbooks } from "./select-workbooks";
import { selectWorkbook } from "./select-workbook";
import { selectResultSheets } from "./select-result-sheets";
import { insertResultSheets } from "./insert-result-sheets";
import { selectDataSetResults } from "./select-data-set-results";
import { updateResultSheets } from "./update-result-sheets";
import { selectResultViews } from "./select-result-views";
import { insertResultViews } from "./insert-result-views";
import { updateResultViews } from "./update-result-views";
import { readResultViews } from "./read-result-views";
import { selectResultView } from "./select-result-view";
import { filterDataSetForTable } from "./filter-data-set-for-table";
import { deleteResultView } from "./delete-result-view";
import { deleteResultSheet } from "./delete-result-sheet";
import { deleteWorkbook } from "./delete-workbook";
import { selectAreaGroups } from "./select-area-groups";
import { updateResultViewsLayoutIndex } from "./update-result-views-layout-index";
import { selectRawDatasets } from "./select-raw-datasets";
import { insertRawDatasets } from "./insert-raw-datasets";
import { saveFile } from "./save-file";
import { selectNormalizedDataSets } from "./select-normalized-datasets";
import { insertNormalizedDatasets } from "./insert-normalized-datasets";
import { selectRawDataset } from "./select-raw-dataset";
import { selectNormalizedDataSet } from "./select-normalized-dataset";
import { selectDataSetResult } from "./select-data-set-result";
import { readDatasetFile } from "./read-dataset-file";
import { selectModelFiles } from "./select-model-files";
import { updateRawDataset } from "./update-raw-dataset";
import { updateNormalizedDataset } from "./update-normalized-dataset";
import { updateDataSetResult } from "./update-data-set-result";
import { deleteRawDataset } from "./delete-raw-dataset";
import { deleteNormalizedDataset } from "./delete-normalized-dataset";
import { deleteDataSetResult } from "./delete-data-set-result";
import { updateModelFiles } from "./update-model-files";
import { deleteModelFiles } from "./delete-model-files";
import { selectJobs } from "./select-jobs";
import { selectJobTasks } from "./select-job-tasks";
import { buildModel } from "./ml/build-model";
import { evaluateData } from "./ml/evaluate-data";
import { selectBuildingsWithPagination } from "./select-buildings-with-pagination";
import { selectAreasWithPagination } from "./select-areas-with-pagination";
import { readDatasetColumns } from "./read-dataset-columns";
import { execE001 } from "./ml/exec-e001";
import { selectJobResults } from "./select-job-results";
import { createNormalizedDatasets } from "./create-normalized-datasets";
import { createModelFiles } from "./create-model-files";
import { insertModelFile } from "./insert-model-file";
import { exportData } from "./ml/export-data";
import { selectJob } from "./select-job";
import { selectNormalizedDatasetWithFilePath } from "./select-normalized-dataset-with-file-path";
import { selectBuildingPreview } from "./select-building-preview";
import { selectRawDatasetWithFilePath } from "./select-raw-dataset-with-file-path";
import { selectJobsWithPagination } from "./select-jobs-with-pagination";
import { fetchChartData } from "./fetch-chart-data";
import { deleteJob } from "./delete-job";

export const ipcMainListeners = {
  helloFromPython,
  saveNameFromPython,
  createWorkbooks,
  selectWorkbooks,
  selectWorkbook,
  selectResultSheets,
  insertResultSheets,
  deleteResultSheet,
  selectDataSetResults,
  createDataSetResults,
  updateResultSheets,
  selectResultViews,
  insertResultViews,
  updateResultViews,
  readResultViews,
  readDatasetColumns,
  selectResultView,
  deleteResultView,
  filterDataSetForTable,
  selectBuildingsInBatches,
  selectReferenceDates,
  selectAreaGroups,
  createDummyDataSetResults,
  selectAreasInBatches,
  deleteWorkbook,
  updateResultViewsLayoutIndex,
  selectRawDatasets,
  insertRawDatasets,
  saveFile,
  selectNormalizedDataSets,
  insertNormalizedDatasets,
  selectRawDataset,
  selectNormalizedDataSet,
  selectDataSetResult,
  readDatasetFile,
  selectModelFiles,
  _debugInsertModelFiles,
  updateRawDataset,
  updateNormalizedDataset,
  updateDataSetResult,
  deleteRawDataset,
  deleteNormalizedDataset,
  deleteDataSetResult,
  updateModelFiles,
  deleteModelFiles,
  selectJobs,
  selectJobTasks,
  buildModel,
  evaluateData,
  execE001,
  selectBuildingsWithPagination,
  selectAreasWithPagination,
  _debugInsertJobs,
  _debugCreateJob,
  selectJobResults,
  createNormalizedDatasets,
  createModelFiles,
  insertModelFile,
  _debugCreateWorkshopData,
  selectBuildingPreview,
  exportData,
  selectJob,
  selectNormalizedDatasetWithFilePath,
  selectRawDatasetWithFilePath,
  selectJobsWithPagination,
  fetchChartData,
  deleteJob,
};

export const execFileAsync = promisify(execFile);

export const binaryPath = (name: string): string => {
  const isDev = process.env.NODE_ENV === "development";
  const _binaryPath = path.resolve(__dirname, "../../../ml/dist", name);
  return isDev ? _binaryPath : path.join(process.resourcesPath, "dist", name);
};

export type IpcMainListener = Parameters<typeof ipcMain.handle>[1];
