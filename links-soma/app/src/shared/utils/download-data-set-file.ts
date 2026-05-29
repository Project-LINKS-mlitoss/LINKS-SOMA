export function downloadDataSetFile(buffer: Buffer, fileName: string): void {
  const url = URL.createObjectURL(new Blob([buffer]));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
