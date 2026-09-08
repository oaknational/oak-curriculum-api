import type { lessonView, LessonView } from '@/lib/owaClient';
import type { Storage } from '@google-cloud/storage';
import { TRPCError } from '@trpc/server';

// How long a signed asset URL stays usable. This governs when the download may
// *start*; a transfer already in flight is not cut off when the URL expires.
export const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

export function getAttribution(
  attribution: LessonView[typeof lessonView][0],
): string[] {
  return Array.from(
    new Set(
      [
        ...(attribution.tpcWorks?.map((_) => _.attribution) || []),
        ...(attribution.tpcMedia?.map((_) => _.attribution) || []),
      ]
        .filter((string) => string !== undefined)
        .filter(Boolean),
    ),
  );
}

interface FileWithMimeType {
  name: string;
  mimeType: string;
}

export async function listFilesWithMimeType(
  storage: Storage,
  bucketName: string,
  prefix: string,
): Promise<FileWithMimeType[]> {
  // make sure to get a listing for the directory (requires trailing slash)
  if (!prefix.endsWith('/')) {
    prefix += '/';
  }

  const [files] = await storage
    .bucket(bucketName)
    .getFiles({ prefix, delimiter: '/' });

  return files.map((file) => ({
    name: file.name,
    mimeType: file.metadata.contentType || 'unknown',
  }));
}

// Sign a read URL for an asset so the client can fetch it straight from Google
// Cloud Storage rather than having the bytes proxied through us. GCS echoes
// `responseDisposition` back as the Content-Disposition of the object, which is
// what preserves the download filename now that we are out of the byte path.
export async function getSignedAssetUrl(
  storage: Storage,
  bucketName: string,
  filePath: string,
  filename: string,
): Promise<string> {
  try {
    const [url] = await storage
      .bucket(bucketName)
      .file(filePath)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + SIGNED_URL_TTL_MS,
        responseDisposition: `attachment; filename="${filename}"`,
      });

    return url;
  } catch (cause) {
    throw new TRPCError({
      message: 'Failed to sign asset URL',
      code: 'INTERNAL_SERVER_ERROR',
      cause,
    });
  }
}

export async function getVideoFromMux(
  sourceUrl: string,
  level: 'high' | 'medium' | 'low' = 'high',
): Promise<string> {
  const url = sourceUrl.replace(/\.m3u8$/, `/${level}.mp4`);
  const response = await fetch(url);
  if (response.status === 200) {
    return url;
  } else if (level === 'low') {
    return '';
  } else {
    const nextLevel = level === 'high' ? 'medium' : 'low';
    return getVideoFromMux(sourceUrl, nextLevel);
  }
}
