import type { Storage } from '@google-cloud/storage';
import { log, logError } from './logger';
import { createReadStream } from 'node:fs';

const bucketName = process.env.BUCKET_NAME;

export function uploadToStorage(
  sequenceDir: string,
  slug: string,
  storage: Storage,
): void {
  // if there's no bucket, let the workflow handle the uploading to GCP storage
  if (!bucketName) {
    return;
  }

  // now send the lesson to gcp storage under the `oak_bulk_data_store` bucket
  const bucket = storage.bucket(bucketName);
  const filePath = `${sequenceDir}/${slug}.json`;
  const destination = `${slug}/${slug}.json`;
  const file = bucket.file(destination);
  const readStream = createReadStream(filePath);
  const writeStream = file.createWriteStream({
    resumable: false,
    gzip: true, // reduces upload time by about 15 seconds
  });
  readStream.on('error', (err) => {
    logError(`Error reading file: ${err}`);
    readStream.destroy();
    writeStream.destroy();
  });
  writeStream.on('error', (err) => {
    logError(`Error uploading file: ${err}`);
    readStream.destroy();
    writeStream.destroy();
  });
  writeStream.on('finish', () => {
    log(`File uploaded to ${bucketName}/${destination}`);
  });
  readStream.pipe(writeStream);
}
