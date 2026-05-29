import { useFetchResultViews } from "../../../../shared/hooks/use-fetch-result-views";

import { type SelectResultView } from "../../../../db/schema";

type Params = {
  resultView: SelectResultView;
};

type ReturnParams = {
  handleDownload: (fileType: string, coordinate: string) => Promise<void>;
  handleDelete: () => Promise<void>;
  isInvalidParameters: boolean;
};

export const useViewContainer = ({ resultView }: Params): ReturnParams => {
  const { mutate } = useFetchResultViews({
    sheetId: resultView.sheet_id,
  });

  const isInvalidParameters =
    !resultView.style ||
    !resultView.unit ||
    (resultView.style !== "map-with-table" && !resultView.parameters);

  const handleDownload = async (
    fileType: string,
    coordinate: string,
  ): Promise<void> => {
    if (!resultView.data_set_result_id || !resultView.unit) return;
    await window.ipcRenderer.invoke("exportData", {
      data: {
        parameterType: "export",
        output_file_type: fileType,
        output_coordinate: coordinate,
        target_unit: resultView.unit,
        view_id: resultView.id,
      },
    });
  };

  const handleDelete = async (): Promise<void> => {
    if (!resultView.sheet_id) return;
    await window.ipcRenderer.invoke("deleteResultView", {
      resultViewId: resultView.id,
      sheetId: resultView.sheet_id,
    });
    await mutate();
  };

  return {
    handleDownload,
    handleDelete,
    isInvalidParameters,
  };
};
