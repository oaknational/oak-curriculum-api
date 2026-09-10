import path from 'node:path';

export const apiCatalogPath = '/.well-known/api-catalog';
export const apiCatalogProfile = 'https://www.rfc-editor.org/info/rfc9727';
export const apiCatalogContentType = `application/linkset+json; profile="${apiCatalogProfile}"`;
export const apiCatalogLinkHeader = `<${apiCatalogPath}>; rel="api-catalog"; type="application/linkset+json"; profile="${apiCatalogProfile}"; title="API catalog"`;
export const homepageDiscoveryLinkHeader = [
  apiCatalogLinkHeader,
  '</api/v1/swagger.json>; rel="service-desc"; type="application/json"; title="OpenAPI description"',
  '</api/v0/swagger.json>; rel="service-desc"; type="application/json"; title="OpenAPI description (v0, frozen)"',
  '</docs/about-oaks-api/api-overview>; rel="service-doc"; type="text/html"; title="API overview"',
  '</playground>; rel="service-doc"; type="text/html"; title="Interactive API playground"',
].join(', ');

/** @type {(phase: string) => Promise<import("next").NextConfig>} */
const getConfig = async () => {
  /** @type {import('next').NextConfig} */
  const config = {
    devIndicators: false,
    // Next 16 defaults to Turbopack, but we pin dev/build back to webpack with
    // `--webpack` (see package.json): Turbopack mis-handles the ESM interop in
    // @swagger-api/apidom-ns-openapi-3-1, so `OpenApi3_1Element.refract` is not
    // a function and swagger-ui's $ref resolution dies. The effect is that
    // /playground renders every operation stuck on a loading spinner, with no
    // parameters, responses or examples.
    // These rules keep the .gql loader working if Turbopack is re-enabled once
    // that interop bug is fixed upstream.
    turbopack: {
      rules: {
        '*.gql': {
          loaders: [path.resolve('./src/loaders/gql.mjs')],
          as: '*.js',
        },
        '*.graphql': {
          loaders: [path.resolve('./src/loaders/gql.mjs')],
          as: '*.js',
        },
      },
    },
    webpack: (config) => {
      config.module.rules.push({
        test: /\.(graphql|gql)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: path.resolve('./src/loaders/gql.mjs'),
          },
        ],
      });

      return config;
    },

    compiler: {
      styledComponents: true,
    },
    // trpc-to-openapi feature-detects zod's coerce support with `'coerce' in z`.
    // Webpack statically folds that `in` expression against zod's ESM namespace
    // to `false`, so the library wrongly rejects every non-string query param
    // (e.g. `offset: z.number()`) with "Input parser key: 'offset' must be
    // ZodString". Externalising it makes Next require the package natively at
    // runtime, where the check evaluates to `true` as intended.
    serverExternalPackages: ['trpc-to-openapi'],
    transpilePackages: ['@oaknational/oak-components'],
    reactStrictMode: true,
    images: {
      // `domains` was removed in Next 16; `remotePatterns` is the replacement.
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'oaknationalacademy-res.cloudinary.com',
        },
        { protocol: 'https', hostname: 'cdn.sanity.io' },
      ],
    },
    productionBrowserSourceMaps: true,
    async headers() {
      return [
        {
          source: '/',
          headers: [
            {
              key: 'Link',
              value: homepageDiscoveryLinkHeader,
            },
          ],
        },
        {
          source: apiCatalogPath,
          headers: [
            {
              key: 'Content-Type',
              value: apiCatalogContentType,
            },
            {
              key: 'Link',
              value: apiCatalogLinkHeader,
            },
          ],
        },
      ];
    },
  };

  return config;
};

export default getConfig;
