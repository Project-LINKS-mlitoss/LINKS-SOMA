import { useForm, FormProvider } from "react-hook-form";
import { FormDataset } from "./components/form-dataset";
import { RadioInput } from "./components/radio-input";
import { Layout } from "./components/layout";
import { ApiInput } from "./components/api-input";
import { RunTab } from "./components/run-tab";
import { Title } from "./components/title";
import { FormValues } from "./type/type";

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
        <Title />
        <FormDataset />
        <RadioInput />
        <ApiInput />
        <RunTab />
      </Layout>
    </FormProvider>
  );
}

export default App;
