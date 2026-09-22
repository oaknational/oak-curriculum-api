import {
  createTrpcHandler,
  trpcPreflight as OPTIONS,
} from '@/lib/api/trpcRoute';

export const dynamic = 'force-dynamic';

const handler = createTrpcHandler('v0');

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  OPTIONS,
  handler as HEAD,
};
