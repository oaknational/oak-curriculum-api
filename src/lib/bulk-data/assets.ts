import type { Storage } from '@google-cloud/storage';
import fs from 'node:fs/promises';
import type { Pack } from 'tar-stream';
import tar from 'tar-stream';
import type {
  LessonAssetsMap,
  ValidDownloadTypes,
  Lesson,
  AssetPacks,
  LessonAsset,
} from './types';
import { logError } from './logger';
import { createWriteStream } from 'node:fs';
import { LessonWithTranscripts } from '../owaClient';

/**
 * tar-stream v3 ships streamx types. streamx and Node streams interoperate at
 * runtime but are not structurally compatible, so piping across the boundary
 * between them needs a cast.
 */
const asNodeWritable = (stream: ReturnType<Pack['entry']>) =>
  stream as unknown as NodeJS.WritableStream;

const asStreamxWritable = (stream: NodeJS.WritableStream) =>
  stream as unknown as Parameters<Pack['pipe']>[0];

export async function downloadQuiz(
  key: ValidDownloadTypes,
  assetLinks: LessonAssetsMap,
  lesson: Lesson | LessonWithTranscripts,
  packs: AssetPacks,
  slug: string,
  storage: Storage,
): Promise<void> {
  // Process starter quiz if available and has bucket_name
  type ValidKeys =
    | ValidDownloadTypes
    | ('exitQuizAnswers' | 'starterQuizAnswers' | 'worksheetAnswers');

  type PackKey = 'starterQuizzes' | 'exitQuizzes' | 'worksheets';

  const findPackKey = (key: ValidDownloadTypes): PackKey => {
    if (key === 'starterQuiz') {
      return 'starterQuizzes';
    } else if (key === 'exitQuiz') {
      return 'exitQuizzes';
    }

    return 'worksheets';
  };

  const type = key.replace('Quiz', '');
  const answerKey: ValidKeys = `${key}Answers`;
  const packKey = findPackKey(key);
  const suffix = key === 'worksheet' ? 'worksheet' : 'quiz';
  const tarFilename = `${slug}-${key === 'worksheet' ? 'worksheets' : 'quizzes'}.tar`;

  if (
    assetLinks[lesson.lessonSlug][key] &&
    assetLinks[lesson.lessonSlug][key].bucket_name &&
    packs[packKey]
  ) {
    try {
      await addStorageAssetToTar(
        packs[packKey],
        assetLinks[lesson.lessonSlug][key],
        `${lesson.lessonSlug}_${type}_${suffix}.pdf`,
        storage,
      );

      lesson[key] = `${tarFilename}:${lesson.lessonSlug}_${type}_${suffix}.pdf`;

      if (
        assetLinks[lesson.lessonSlug][answerKey] &&
        assetLinks[lesson.lessonSlug][answerKey].bucket_name
      ) {
        await addStorageAssetToTar(
          packs[packKey],
          assetLinks[lesson.lessonSlug][answerKey],
          `${lesson.lessonSlug}_${type}_${suffix}_answers.pdf`,
          storage,
        );

        lesson[answerKey] =
          `${tarFilename}:${lesson.lessonSlug}_${type}_${suffix}_answers.pdf`;
      }
    } catch (e) {
      logError(
        `Failed to process ${type} for ${lesson.lessonSlug}: ${e as string}`,
      );
      logError(
        `${type} data: ${JSON.stringify(assetLinks[lesson.lessonSlug][key])}`,
      );
    }
  }
}

export async function addURLToQueue(
  url: string,
  filename: string,
  sequence: string,
): Promise<void> {
  // this is picked up by build-bulk-download-videos.sh
  await fs.appendFile(
    `${__dirname}/videos.tsv`,
    `${url}\t${filename}\t${sequence}\n`,
  );
}

export async function addStorageAssetToTar(
  pack: Pack,
  asset: LessonAsset,
  filename: string,
  storage: Storage,
): Promise<void> {
  if (!asset || !asset.bucket_name || !asset.bucket_path) {
    throw new Error(`Invalid asset data: ${JSON.stringify(asset)}`);
  }

  const { bucket_name, bucket_path } = asset;

  // First, get the file metadata to determine its size
  const file = storage.bucket(bucket_name).file(bucket_path);

  try {
    const [metadata] = await file.getMetadata();
    const size = metadata.size ? parseInt(metadata.size + '', 10) : undefined;

    return new Promise<void>((resolve, reject) => {
      const nodeStream = file.createReadStream();
      const entry = pack.entry(
        {
          name: filename,
          size: size,
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(void 0);
          }
        },
      );

      nodeStream.pipe(asNodeWritable(entry));
      nodeStream.on('error', (err: Error) => {
        logError(`Stream error: ${err}`);
        reject(err);
      });
    });
  } catch (error) {
    logError(`Error getting file metadata: ${error as string}`);
    throw error;
  }
}

/**
 * Mutates the assetPacks object to add tarballs for different asset types.
 */
export function buildAssetPacks(
  sequenceDir: string,
  slug: string,
  assetPacks: AssetPacks,
): void {
  // Create tarballs for different asset types
  const worksheetsOutput = createWriteStream(
    `${sequenceDir}/${slug}-worksheets.tar`,
  );
  const worksheetsPack = tar.pack();
  worksheetsPack.pipe(asStreamxWritable(worksheetsOutput));

  // Create slide decks tarball
  const slideDecksOutput = createWriteStream(
    `${sequenceDir}/${slug}-slide-decks.tar`,
  );
  const slideDecksPack = tar.pack();
  slideDecksPack.pipe(asStreamxWritable(slideDecksOutput));

  // Create quizzes tarball
  const quizzesOutput = createWriteStream(`${sequenceDir}/${slug}-quizzes.tar`);
  const quizzesPack = tar.pack();
  quizzesPack.pipe(asStreamxWritable(quizzesOutput));

  // Create supplementary resources tarball
  const resourcesOutput = createWriteStream(
    `${sequenceDir}/${slug}-resources.tar`,
  );
  const resourcesPack = tar.pack();
  resourcesPack.pipe(asStreamxWritable(resourcesOutput));

  // Create asset packs object
  assetPacks.worksheets = worksheetsPack;
  assetPacks.slideDecks = slideDecksPack;
  assetPacks.starterQuizzes = quizzesPack;
  assetPacks.exitQuizzes = quizzesPack;
  assetPacks.supplementaryResources = resourcesPack;
}
