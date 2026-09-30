import { Storage } from '@google-cloud/storage';
import { IdentityPoolClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

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
        getSubjectToken: () => getVercelOidcToken(),
      },
    });

    return new Storage({ authClient });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    ) as object;

    return new Storage({ credentials });
  }

  return new Storage();
}
