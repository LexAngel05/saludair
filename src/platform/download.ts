/** Triggers a browser download of generated content (no network involved). */
export function downloadText(filename: string, content: string, mime: string): void {
  // BOM so Excel opens UTF-8 CSV (µ, ñ, á) correctly.
  const BOM = String.fromCharCode(0xfeff);
  const body = mime.startsWith('text/csv') ? BOM + content : content;
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a user-picked file as text. */
export function readFileText(file: File): Promise<string> {
  return file.text();
}
