import { dialogsExportEn } from "./en/dialogs-export";
import { dialogsManageEn } from "./en/dialogs-manage";
import { propertiesEn } from "./en/properties";
import { propertiesBulkEn } from "./en/properties-bulk";
import { stateEn } from "./en/state";
import { toolbarEn } from "./en/toolbar";
import { workspaceEn } from "./en/workspace";
import type { Messages } from "./index";

export const en: Messages = {
  ...toolbarEn,
  ...propertiesEn,
  ...propertiesBulkEn,
  ...dialogsExportEn,
  ...dialogsManageEn,
  ...workspaceEn,
  ...stateEn,
};
