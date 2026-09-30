import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  BaseExternalAccountClient,
  IdentityPoolClient,
} from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';
import { getGoogleCloudStorage } from '@/lib/googleCloudStorage';

// Capture what `new Storage()` was handed, which is the whole point of these
// tests: the credential branching is what we own, everything past it is
// Google's code. `google-auth-library` is deliberately NOT mocked — the real
// classes are what make the assertions below mean anything.
const storageOptions: unknown[] = [];

vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(function Storage(options?: unknown) {
    storageOptions.push(options);
  }),
}));

vi.mock('@vercel/oidc', () => ({
  getVercelOidcToken: vi.fn().mockResolvedValue('fake-oidc-token'),
}));

const AUDIENCE =
  '//iam.googleapis.com/projects/653234685171/locations/global/workloadIdentityPools/vercel/providers/vercel';
const SERVICE_ACCOUNT =
  'wif-vercel-oak-curriculum-api@oak-national-academy.iam.gserviceaccount.com';

const env = process.env;

beforeEach(() => {
  process.env = { ...env };
  delete process.env.GCP_WIF_AUDIENCE;
  delete process.env.GCP_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  storageOptions.length = 0;
  vi.mocked(getVercelOidcToken).mockClear();
});

afterEach(() => {
  process.env = env;
});

/** The federated client, as the storage constructor received it. */
function signingClient(): IdentityPoolClient {
  const options = storageOptions.at(-1) as { authClient: IdentityPoolClient };
  return options.authClient;
}

test('federates to a service account when the workload identity settings are set', () => {
  process.env.GCP_WIF_AUDIENCE = AUDIENCE;
  process.env.GCP_SERVICE_ACCOUNT_EMAIL = SERVICE_ACCOUNT;

  getGoogleCloudStorage();

  // `BaseExternalAccountClient` is the exact check google-auth-library makes
  // before it will produce a `client_email`, and a `client_email` is what v4
  // signing needs. It also fails loudly if a second copy of
  // google-auth-library is ever resolved alongside @google-cloud/storage's.
  expect(signingClient()).toBeInstanceOf(IdentityPoolClient);
  expect(signingClient()).toBeInstanceOf(BaseExternalAccountClient);
});

test('impersonates the service account it was given', () => {
  process.env.GCP_WIF_AUDIENCE = AUDIENCE;
  process.env.GCP_SERVICE_ACCOUNT_EMAIL = SERVICE_ACCOUNT;

  getGoogleCloudStorage();

  // Read back off the impersonation URL, so a malformed template shows up
  // here rather than as "Cannot sign data without `client_email`" in prod.
  expect(signingClient().getServiceAccountEmail()).toBe(SERVICE_ACCOUNT);
});

test('asks Vercel for its own token, not one stamped for Google', async () => {
  process.env.GCP_WIF_AUDIENCE = AUDIENCE;
  process.env.GCP_SERVICE_ACCOUNT_EMAIL = SERVICE_ACCOUNT;

  getGoogleCloudStorage();

  await expect(signingClient().retrieveSubjectToken()).resolves.toBe(
    'fake-oidc-token',
  );
  // The arrow wrapper round `getVercelOidcToken` exists to swallow
  // google-auth-library's supplier context. Handed the function bare, the
  // Google resource path would arrive as `options.audience` and Vercel would
  // mint a token with the wrong `aud` for our provider to accept.
  expect(getVercelOidcToken).toHaveBeenCalledWith();
});

test('ignores the workload identity settings unless both are present', () => {
  process.env.GCP_WIF_AUDIENCE = AUDIENCE;
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON =
    '{"type":"service_account"}';

  getGoogleCloudStorage();

  expect(storageOptions.at(-1)).toEqual({
    credentials: { type: 'service_account' },
  });
});

test('falls back to the service account key', () => {
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON =
    '{"type":"service_account"}';

  getGoogleCloudStorage();

  expect(storageOptions.at(-1)).toEqual({
    credentials: { type: 'service_account' },
  });
});

test('falls back to application default credentials', () => {
  getGoogleCloudStorage();

  expect(storageOptions.at(-1)).toBeUndefined();
});
