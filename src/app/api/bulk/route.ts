import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Context } from '@/lib/context';
import { getApiKeyFromRequest, withUser } from '@/lib/context';
import { protect } from '@/lib/protect';
import type { File } from '@google-cloud/storage';
import codes from 'http-codes';
import yazl from 'yazl';
import { getGoogleCloudStorage } from '@/lib/bulk-data/data-stores';
import {
  captureApiRequestEvent,
  parseQueryParams,
} from '@/lib/analytics/posthogServer';
export const dynamic = 'force-dynamic';
import schema from './schema.json/schema.json' with { type: 'json' };

const bucketName = process.env.BULK_DATA_BUCKET || 'oak-prod-ldn-bulk-uploader';
const endpointPath = '/api/bulk';

const storage = getGoogleCloudStorage();

const hasErrorCode = (error: unknown): error is { code: string } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  );
};

const handler = async (req: NextRequest): Promise<Response> => {
  const startedAt = Date.now();
  const apiKey = getApiKeyFromRequest(req);
  const queryParams = parseQueryParams(req.url);
  let args: { subjects?: string[] } | undefined;
  let userId: number | undefined;

  const resHeaders = new Headers();

  try {
    // 1. get the user

    const user = await withUser(req, apiKey);
    userId = user?.id;

    const ctx = {
      user,
      resHeaders,
      req,
    } as unknown as Context;

    // manually check the protect

    await new Promise<void>((resolve, reject) => {
      protect({
        ctx,
        next: () => Promise.resolve().then(resolve),
        meta: { noCost: false },
      }).catch(reject);
    });

    const body = (await req.json()) as { subjects?: string[] };
    args = body;
    const subjects = body.subjects || [];

    const allFiles: File[] = [];

    for (const subject of subjects) {
      const [files] = await storage
        .bucket(bucketName)
        .getFiles({ prefix: `${subject}/${subject}.json`, delimiter: '/' });

      if (files && files.length > 0) {
        allFiles.push(...files);
      }
    }

    const zipFile = new yazl.ZipFile();

    // read ./schema.json and add it to the zip
    // const schemaContent = await readFile('./schema.json');
    zipFile.addBuffer(new Buffer(JSON.stringify(schema)), 'schema.json');

    for (const file of allFiles) {
      zipFile.addReadStream(
        file.createReadStream(),
        file.name.split('/').pop() || file.name,
      );
    }

    zipFile.end();
    const zipStream = zipFile.outputStream;

    resHeaders.set('Content-Type', 'application/zip');

    const response = new Response(zipStream as unknown as BodyInit, {
      headers: resHeaders,
    });

    captureApiRequestEvent({
      url: req.url,
      apiKey,
      args,
      durationMs: Date.now() - startedAt,
      endpointPath,
      httpMethod: req.method || 'POST',
      queryParams,
      source: 'bulk_route',
      success: true,
      userId,
    });

    return response;
  } catch (e: unknown) {
    let errorCode = 'UNKNOWN_ERROR';
    if (hasErrorCode(e)) {
      errorCode = e.code;
    } else if (e instanceof Error) {
      errorCode = e.name;
    }

    captureApiRequestEvent({
      url: req.url,
      apiKey,
      args,
      durationMs: Date.now() - startedAt,
      endpointPath,
      errorCode,
      httpMethod: req.method || 'POST',
      queryParams,
      source: 'bulk_route',
      success: false,
      userId,
    });

    throw e;
  }
};

async function handlerWrapper(req: NextRequest): Promise<Response> {
  try {
    return await handler(req);
  } catch (e: unknown) {
    const { code, message } = e as { code: string; message: string };

    const statusCode =
      typeof code === 'string' && code in codes
        ? codes[code as keyof typeof codes]
        : 500;

    return new NextResponse(JSON.stringify({ message, code }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export { handlerWrapper as POST };

// by default Vercel set the max limit to 5 minutes
// https://vercel.com/docs/functions/limitations#max-duration
// export const maxDuration = 60 * 5; // seconds
