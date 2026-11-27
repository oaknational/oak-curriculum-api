import {
  createImageUrlBuilder,
  type ImageUrlBuilder,
  type SanityImageSource,
} from '@sanity/image-url';
import getServerConfig from '@/node-lib/serverConfig';

const projectId = getServerConfig('sanityProjectId');
const dataset = getServerConfig('sanityDataset');

// https://www.sanity.io/docs/image-url
const builder = createImageUrlBuilder({ projectId, dataset });

export const urlFor = (source: SanityImageSource): ImageUrlBuilder => {
  return builder.image(source);
};
