import "@denreport/designer/styles/tokens.css";
import "@denreport/designer/styles/app.css";
import { Designer } from "@denreport/designer";
import { getHostMessages } from "./i18n";
import { createNoticeArea } from "./notice";
import {
  attachAutosave,
  restoreExportTarget,
  restoreIr,
  restoreLocale,
  SAMPLE_DATA_STORAGE_KEY,
} from "./persistence";

const container = document.getElementById("app");
if (container === null) {
  throw new Error("#app 要素が見つかりません");
}

const storedSampleData = localStorage.getItem(SAMPLE_DATA_STORAGE_KEY);
const storedExportTarget = restoreExportTarget(localStorage);
const storedLocale = restoreLocale(localStorage);
const designer = new Designer(container, {
  ...(storedSampleData === null ? {} : { initialSampleData: storedSampleData }),
  ...(storedExportTarget === undefined
    ? {}
    : { initialExportTarget: storedExportTarget }),
  ...(storedLocale === undefined ? {} : { locale: storedLocale }),
});

const initialMessages = getHostMessages(designer.getLocale());
const notice = createNoticeArea(document, initialMessages.noticeClose);
document.body.prepend(notice.element);

document.documentElement.lang = designer.getLocale();
document.title = initialMessages.title;
designer.onLocaleChange(() => {
  const locale = designer.getLocale();
  document.documentElement.lang = locale;
  document.title = getHostMessages(locale).title;
});

if (restoreIr(designer, localStorage) === "invalid") {
  notice.show(initialMessages.notices.irLoadFailed);
}

attachAutosave(designer, localStorage, window, () => {
  notice.show(getHostMessages(designer.getLocale()).notices.autosaveFailed);
});
