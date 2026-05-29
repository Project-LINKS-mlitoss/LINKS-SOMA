import { AddFilled, Dismiss24Regular } from "@fluentui/react-icons";
import {
  Dialog,
  DialogTrigger,
  Field,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../../shared/components/ui/button";
import { Form } from "../../../shared/components/ui/form";
import { DialogSurface } from "../../../shared/components/ui/dialog-surface";
import { DialogTitle } from "../../../shared/components/ui/dialog-title";
import { Input } from "../../../shared/components/ui/input";
import { DialogActions } from "../../../shared/components/ui/dialog-actions";
import { DialogBody } from "../../../shared/components/ui/dialog-body";
import { DialogContent } from "../../../shared/components/ui/dialog-content";

const useStyles = makeStyles({
  input: {
    width: "100%",
  },
});

const formSchema = z.object({
  title: z.string().min(1, {
    message: "ワークブック名を入力してください",
  }),
});

export const ButtonCreateWorkbook = (): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();

  const {
    handleSubmit,
    formState: { errors },
    register,
  } = useForm({
    defaultValues: {
      title: "",
    },
    resolver: zodResolver(formSchema),
  });

  const onSubmit = handleSubmit(async (data): Promise<void> => {
    const res = await window.ipcRenderer.invoke("createWorkbooks", {
      title: data.title,
    });
    navigate(`/analysis/workbook/${res.id}/edit`);
  });

  return (
    <Dialog>
      <DialogTrigger disableButtonEnhancement>
        <Button
          icon={
            <AddFilled
              color={tokens.colorNeutralForeground1}
              fontSize={tokens.fontSizeBase400}
              strokeWidth={2}
            />
          }
          size="small"
        >
          新規ワークブック作成
        </Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  icon={
                    <Dismiss24Regular
                      color={tokens.colorNeutralForeground1}
                      strokeWidth={2}
                    />
                  }
                />
              </DialogTrigger>
            }
          >
            ワークブック名
          </DialogTitle>
          <DialogContent>
            <Form id="create-workbook" onSubmit={onSubmit}>
              <Field validationMessage={errors.title?.message}>
                <Input className={styles.input} {...register("title")} />
              </Field>
            </Form>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              form="create-workbook"
              size="medium"
              type="submit"
            >
              保存
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
