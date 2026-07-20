import { dialogsExportEn } from "./en/dialogs-export.js";
import { dialogsManageEn } from "./en/dialogs-manage.js";
import { propertiesEn } from "./en/properties.js";
import { propertiesBulkEn } from "./en/properties-bulk.js";
import { stateEn } from "./en/state.js";
import { toolbarEn } from "./en/toolbar.js";
import { workspaceEn } from "./en/workspace.js";
import type { Messages } from "./index.js";

export const en: Messages = {
  ...toolbarEn,
  ...propertiesEn,
  ...propertiesBulkEn,
  ...dialogsExportEn,
  ...dialogsManageEn,
  ...workspaceEn,
  ...stateEn,
};
