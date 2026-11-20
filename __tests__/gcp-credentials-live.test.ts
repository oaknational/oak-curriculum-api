import { beforeAll, describe, expect, test } from 'vitest';
import type { File } from '@google-cloud/storage';
import { TRPCError } from '@trpc/server';
import { getGoogleCloudStorage } from '@/lib/googleCloudStorage';
import { getSignedAssetUrl } from '@/lib/handlers/assets/helpers';

/**
 * Does the credential this process loaded actually work against Google Cloud
 * Storage? Nothing here is mocked, because a mock can only prove that we call
 * Google correctly — not that Google will accept us. Both production failures
 * this guards against look like working code:
 *
 * - a credential that reads objects but cannot sign, because the service
 *   account is missing `iam.serviceAccounts.signBlob` (the asset endpoints
 *   hand out signed URLs, so they break while the bulk route stays fine);
 * - a signature that is well formed but that Google rejects, which no
 *   assertion on the URL string can ever catch.
 *
 * So the test does the two authenticated things the code does for real: it
 * reads an object through the calls the bulk route and bulk pipeline make, and
 * it signs a v4 read URL and asks Google to honour it. It never downloads an
 * object — the signed URL is fetched with a one-byte range request.
 *
 * ## Running it
 *
 * Off by default, as it needs live credentials and network:
 *
 * ```bash
 * RUN_LIVE_GCP_TESTS=true pnpm test gcp-credentials-live
 * ```
 *
 * It uses whichever credential `getGoogleCloudStorage` finds, in that
 * function's documented order. Locally the workload identity path is tried
 * first whenever `GCP_WIF_AUDIENCE` and `GCP_SERVICE_ACCOUNT_EMAIL` are set,
 * and that needs an unexpired `VERCEL_OIDC_TOKEN` from `vercel env pull`.
 *
 * Unsetting those two falls through to `GOOGLE_APPLICATION_CREDENTIALS_JSON`,
 * the bulk pipeline's credential. Expect the signing test to fail there unless
 * that JSON is a service account key with a private key in it: the pipeline
 * only reads and uploads, so the credential it is given need not be able to
 * sign, and a configuration that cannot sign reports itself here as "Cannot
 * sign data without `client_email`". Signing is the API's path, on workload
 * identity federation.
 */
const runLiveGcpTests = process.env.RUN_LIVE_GCP_TESTS === 'true';

// The bucket the bulk route reads, and the same default, so the test needs no
// setup beyond a credential.
const bucketName = process.env.BULK_DATA_BUCKET || 'oak-prod-ldn-bulk-uploader';

// Live calls cross the network two or three times over (token exchange, then
// the storage or IAM call), which the suite-wide 10s does not allow for.
const LIVE_TIMEOUT_MS = 30_000;

describe.skipIf(!runLiveGcpTests)('Google Cloud credentials (live)', () => {
  const storage = getGoogleCloudStorage();

  // Any real object will do. Listing one is itself the authenticated call
  // `/api/bulk` makes, so it has to work before the rest of the file means
  // anything — hence the listing lives here rather than in a test of its own.
  let file: File;

  beforeAll(async () => {
    const [files] = await storage.bucket(bucketName).getFiles({
      maxResults: 1,
    });

    expect(
      files.length,
      `No objects listed in ${bucketName}; the credential may be sound but the bucket is empty, so the rest of this file cannot run.`,
    ).toBeGreaterThan(0);

    file = files[0];
  }, LIVE_TIMEOUT_MS);

  test(
    'reads object metadata without downloading the object',
    async () => {
      // `getMetadata` is how the bulk pipeline sizes an asset before streaming
      // it into a tarball, and it is the cheapest authenticated read of a
      // single object there is.
      const [metadata] = await file.getMetadata();

      expect(metadata.name).toBe(file.name);
      expect(metadata.bucket).toBe(bucketName);
    },
    LIVE_TIMEOUT_MS,
  );

  test(
    'signs a v4 read URL, and Google honours the signature',
    async () => {
      const url = await getSignedAssetUrl(
        storage,
        bucketName,
        file.name,
        'credential-check.json',
      ).catch((error: unknown) => {
        // The handler deliberately flattens signing failures into one opaque
        // message. Credentials are the thing under test, so put Google's own
        // reason back on the surface.
        throw error instanceof TRPCError && error.cause ? error.cause : error;
      });

      expect(url).toContain('X-Goog-Signature=');

      // The signature is only as good as Google's opinion of it, and one byte
      // is enough to collect that opinion.
      const response = await fetch(url, { headers: { Range: 'bytes=0-0' } });

      if (response.ok) {
        // 206 for the byte asked for, or 200 when the object is stored gzipped
        // and Google decompresses it rather than ranging over it. Either answer
        // means the signature was accepted, which is the whole question here,
        // so the body is dropped unread instead of downloaded.
        await response.body?.cancel();
        return;
      }

      expect.fail(
        `Google rejected the signed URL (${response.status}): ${await response.text()}`,
      );
    },
    LIVE_TIMEOUT_MS,
  );
});
