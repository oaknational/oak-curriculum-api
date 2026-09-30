import { Storage } from '@google-cloud/storage';
import { IdentityPoolClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

import { assetError, assetLog, describeOidcClaims } from '@/lib/assetDebugLog';

/**
 * Build a Google Cloud Storage client. Three ways in, tried in order.
 *
 * 1. Workload Identity Federation. Vercel mints a short-lived OIDC token for
 *    the running function and Google's STS swaps it for one impersonating
 *    `GCP_SERVICE_ACCOUNT_EMAIL`. No private key exists, so there is nothing
 *    to leak and nothing to rotate. This is the path on Vercel, and locally
 *    once `vercel env pull` has written a token.
 * 2. A service account key in `GOOGLE_APPLICATION_CREDENTIALS_JSON`, which is
 *    how the bulk pipeline authenticates from GitHub Actions and Cloud Run.
 * 3. Application Default Credentials, for anywhere Google's own discovery
 *    already works.
 *
 * Keep the federation settings out of the bulk pipeline's environment: off
 * Vercel there is no OIDC token to fetch, so this path would fail when the
 * pipeline tried to authenticate.
 */
export function getGoogleCloudStorage(): Storage {
  const audience = process.env.GCP_WIF_AUDIENCE;
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;

  if (audience && serviceAccountEmail) {
    // Both are public identifiers, so they are safe to log, and which service
    // account we impersonate is the first thing to check against the bucket's
    // IAM when a download comes back 403.
    assetLog('credentials: workload identity federation', {
      audience,
      serviceAccountEmail,
      hasVercelOidcTokenEnv: Boolean(process.env.VERCEL_OIDC_TOKEN),
      vercelEnv: process.env.VERCEL_ENV,
    });

    const authClient = new IdentityPoolClient({
      audience,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
      subject_token_supplier: {
        // google-auth-library calls this with its own context, whose
        // `audience` is the Google resource path above. `getVercelOidcToken`
        // reads an `audience` off its options too, so handing the function
        // over bare would mint a token stamped for the wrong `aud` and STS
        // would reject it. The wrapper drops the argument. Do not remove it.
        getSubjectToken: async () => {
          try {
            const token = await getVercelOidcToken();

            // The claims, never the token. `aud` is the one that matters: it
            // must match the provider the pool trusts, not the Google audience
            // above.
            assetLog('oidc: token minted', describeOidcClaims(token));

            return token;
          } catch (error) {
            // `getVercelOidcToken` reports a refresh failure as a bare path
            // error that says nothing about the token it was refreshing. The
            // claims of whatever is in the environment separate the two cases
            // worth telling apart: an expired token, or one stamped for an
            // audience the pool does not trust.
            const envToken = process.env.VERCEL_OIDC_TOKEN;

            assetError('oidc: mint token', error, {
              envTokenClaims: envToken
                ? describeOidcClaims(envToken)
                : '(VERCEL_OIDC_TOKEN not set)',
            });

            throw error;
          }
        },
      },
    });

    return new Storage({ authClient });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    ) as object;

    assetLog('credentials: service account key', {
      // The client email is an identifier, not the key.
      clientEmail: (credentials as { client_email?: string }).client_email,
      // A missing audience or email here is why federation was skipped.
      hasAudience: Boolean(audience),
      hasServiceAccountEmail: Boolean(serviceAccountEmail),
    });

    return new Storage({ credentials });
  }

  assetLog('credentials: application default', {
    hasAudience: Boolean(audience),
    hasServiceAccountEmail: Boolean(serviceAccountEmail),
  });

  return new Storage();
}
