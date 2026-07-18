import "@denreport/designer/styles/tokens.css";
import "@denreport/designer/styles/app.css";
import { Designer } from "@denreport/designer";
import { createNoticeArea } from "./notice";
import {
  attachAutosave,
  restoreIr,
  SAMPLE_DATA_STORAGE_KEY,
} from "./persistence";

const notice = createNoticeArea(document);
document.body.prepend(notice.element);

const container = document.getElementById("app");
if (container === null) {
  throw new Error("#app 要素が見つかりません");
}

const storedSampleData = localStorage.getItem(SAMPLE_DATA_STORAGE_KEY);
const designer = new Designer(
  container,
  storedSampleData === null
    ? undefined
    : { initialSampleData: storedSampleData },
);

if (restoreIr(designer, localStorage) === "invalid") {
  notice.show(
    "保存されていたテンプレートを読み込めませんでした。白紙で開始します。",
  );
}

attachAutosave(designer, localStorage, window, () => {
  notice.show(
    "自動保存に失敗しました。ブラウザの保存領域が不足している可能性があります。",
  );
});
