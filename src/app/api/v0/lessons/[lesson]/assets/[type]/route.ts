import {
  assetDownloadPreflight as OPTIONS,
  createAssetDownloadHandler,
} from '@/lib/handlers/assetDownload/assetDownload';

export const dynamic = 'force-dynamic';

const handler = createAssetDownloadHandler('v0');

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  OPTIONS,
  handler as HEAD,
};
