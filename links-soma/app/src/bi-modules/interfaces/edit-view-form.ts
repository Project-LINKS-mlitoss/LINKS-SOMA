import { type z } from "zod";
import { type editViewFormSchema } from "../schema/edit-view-form";

export type EditViewFormType = z.infer<typeof editViewFormSchema>;
