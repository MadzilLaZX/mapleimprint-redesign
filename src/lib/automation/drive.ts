import { Readable } from "stream";
import { google } from "googleapis";
import { getGoogleAuth } from "./google";

function getDrive() {
  const auth = getGoogleAuth();
  if (!auth) return null;
  return google.drive({ version: "v3", auth });
}

export type UploadedFile = {
  fileId: string;
  fileName: string;
  fileSize: number;
  contentType: string | null;
  webViewLink: string | null;
};

/**
 * Uploads one file into the shared Drive folder from AUTOMATION.md's setup.
 * Returns null when Google credentials/folder aren't configured, so the
 * upload route can respond with a friendly "not available yet" error.
 */
export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  contentType: string | null,
): Promise<UploadedFile | null> {
  const drive = getDrive();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!drive || !folderId) return null;

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: contentType ?? undefined, body: Readable.from(buffer) },
    fields: "id, name, size, webViewLink",
  });

  return {
    fileId: res.data.id ?? "",
    fileName: res.data.name ?? fileName,
    fileSize: buffer.byteLength,
    contentType,
    webViewLink: res.data.webViewLink ?? null,
  };
}
