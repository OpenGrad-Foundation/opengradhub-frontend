import JSZip from "jszip";

const MIME_MAP: Record<string, string> = {
  pdf:  "application/pdf",
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  gif:  "image/gif",
  webp: "image/webp",
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export interface ZipEntry {
  name: string;
  open: () => Promise<void>;
}

async function fetchZip(presignedUrl: string): Promise<JSZip> {
  const proxyUrl = `/api/submissions/proxy-zip?url=${encodeURIComponent(presignedUrl)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error(`Failed to fetch submission: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return JSZip.loadAsync(buffer);
}

function makeEntry(file: JSZip.JSZipObject): ZipEntry {
  return {
    name: file.name,
    open: async () => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const mimeType = MIME_MAP[ext] ?? "application/octet-stream";
      const blob = new Blob([await file.async("arraybuffer")], { type: mimeType });
      window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
    },
  };
}

export async function getZipEntries(presignedUrl: string): Promise<ZipEntry[]> {
  const zip = await fetchZip(presignedUrl);
  const files = Object.values(zip.files).filter((f) => !f.dir);
  if (files.length === 0) throw new Error("Submission archive is empty");
  return files.map(makeEntry);
}

export async function openZipContents(presignedUrl: string): Promise<void> {
  const entries = await getZipEntries(presignedUrl);
  for (const entry of entries) await entry.open();
}
