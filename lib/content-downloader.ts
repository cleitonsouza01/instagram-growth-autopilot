import { logger } from "../utils/logger";

/**
 * Download content (photos, carousels, stories, reels, profile pics).
 * All downloads are client-side fetches saved via blob URLs.
 */

export interface DownloadResult {
  success: boolean;
  filename: string;
  error?: string;
}

/**
 * Download a single media URL as a file.
 */
export async function downloadMedia(
  url: string,
  filename: string,
): Promise<DownloadResult> {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) {
      return { success: false, filename, error: `HTTP ${response.status}` };
    }

    const blob = await response.blob();
    triggerDownload(blob, filename);
    logger.info("content-downloader", `Downloaded: ${filename}`);

    return { success: true, filename };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("content-downloader", `Download failed: ${filename}`, message);
    return { success: false, filename, error: message };
  }
}

/**
 * Download all images from a carousel post.
 */
export async function downloadCarousel(
  urls: string[],
  baseFilename: string,
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];

  for (let i = 0; i < urls.length; i++) {
    const ext = getExtension(urls[i]!);
    const filename = `${baseFilename}_${i + 1}.${ext}`;
    const result = await downloadMedia(urls[i]!, filename);
    results.push(result);
  }

  return results;
}

/**
 * Download a profile picture at full resolution.
 */
export async function downloadProfilePic(
  url: string,
  username: string,
): Promise<DownloadResult> {
  // Platform serves profile pics at various sizes. Try to get the full version.
  const fullUrl = url.replace(/\/s\d+x\d+\//, "/s1080x1080/");
  return downloadMedia(fullUrl, `${username}_profile.jpg`);
}

/**
 * Trigger a browser download for a blob.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop();
    if (ext && ["jpg", "jpeg", "png", "webp", "mp4"].includes(ext)) {
      return ext;
    }
  } catch {
    // Invalid URL
  }
  return "jpg";
}
