/** Saves blob as a file named filename. Creates a Blob URL, clicks a[download], and
    revokes it immediately (the caller is responsible for giving the Blob its MIME type) */
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
