import { Suspense } from "react";
import { EditWorkbook as EditWorkbookComponent } from "../../../../components/edit-workbook";

export function EditWorkbook(): JSX.Element {
  return (
    <Suspense>
      <EditWorkbookComponent />
    </Suspense>
  );
}
