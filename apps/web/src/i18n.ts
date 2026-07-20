export interface HostMessages {
  readonly title: string;
  readonly noticeClose: string;
  readonly notices: {
    readonly irLoadFailed: string;
    readonly autosaveFailed: string;
  };
}

const ja: HostMessages = {
  title: "帳票デザイナー",
  noticeClose: "閉じる",
  notices: {
    irLoadFailed:
      "保存されていたテンプレートを読み込めませんでした。白紙で開始します。",
    autosaveFailed:
      "自動保存に失敗しました。ブラウザの保存領域が不足している可能性があります。",
  },
};

const en: HostMessages = {
  title: "Report Designer",
  noticeClose: "Close",
  notices: {
    irLoadFailed:
      "Could not load the saved template. Starting with a blank document.",
    autosaveFailed: "Autosave failed. The browser's storage may be full.",
  },
};

export function getHostMessages(locale: "ja" | "en"): HostMessages {
  return locale === "ja" ? ja : en;
}
