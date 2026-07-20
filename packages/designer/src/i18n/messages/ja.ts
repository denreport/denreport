import { dialogsExportJa } from "./ja/dialogs-export.js";
import { dialogsManageJa } from "./ja/dialogs-manage.js";
import { propertiesJa } from "./ja/properties.js";
import { propertiesBulkJa } from "./ja/properties-bulk.js";
import { stateJa } from "./ja/state.js";
import { toolbarJa } from "./ja/toolbar.js";
import { workspaceJa } from "./ja/workspace.js";

export const ja = {
  ...toolbarJa,
  ...propertiesJa,
  ...propertiesBulkJa,
  ...dialogsExportJa,
  ...dialogsManageJa,
  ...workspaceJa,
  ...stateJa,
};
