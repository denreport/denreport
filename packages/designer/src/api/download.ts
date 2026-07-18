/** blob を filename のファイルとして保存させる。Blob URL を生成し a[download] を click して
    即 revoke する（MIME は呼び出し元が Blob に持たせる） */
export function triggerDownload(
  doc: Document,
  filename: string,
  blob: Blob,
): void {
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
