import { useForm, FormProvider, useWatch } from "react-hook-form";
import { FormDataset } from "./components/form-dataset";
import { RadioInput } from "./components/radio-input";
import { Layout } from "./components/layout";
import { ApiInput } from "./components/api-input";
import { AbrDownload } from "./components/abr-download";
import { RunTab } from "./components/run-tab";
import { Title } from "./components/title";
import { FormValues } from "./type/type";

function AppContent() {
  const apiType = useWatch<FormValues>({ name: "apiType" });

  return (
    <>
      <Title />
      <FormDataset />
      <RadioInput />
      <ApiInput />
      {apiType === "abr" && <AbrDownload />}
      <RunTab />
    </>
  );
}

function App() {
  const methods = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      apiType: "aws",
    },
  });

  return (
    <FormProvider {...methods}>
      <Layout>
        <AppContent />
      </Layout>
    </FormProvider>
  );
}

export default App;
