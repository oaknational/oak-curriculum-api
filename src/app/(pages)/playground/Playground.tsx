'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { SwaggerUIProps } from 'swagger-ui-react';

import type { ApiMajor } from '@/lib/apiVersion';
import { API_MAJORS, LATEST_API_MAJOR, majorStatus } from '@/lib/apiVersion';
import 'swagger-ui-react/swagger-ui.css';
import '@/app/(pages)/playground/playground.css';

const SwaggerUI = dynamic<SwaggerUIProps>(() => import('swagger-ui-react'), {
  ssr: false,
});

interface MutableSwaggerResponse {
  status: number;
  type?: string;
  ok?: boolean;
  statusText?: string;
  headers: Record<string, string | undefined>;
  text?: string;
  data?: unknown;
  obj?: unknown;
}

interface SwaggerSystem {
  fn: {
    requestSnippetGenerator_curl_bash: (request: unknown) => string;
  };
}

// The `request` Swagger UI hands to a snippet generator is an Immutable Map.
interface SwaggerRequest {
  get: (key: string) => unknown;
}

interface ParsedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

const parseRequest = (request: unknown): ParsedRequest => {
  const req = request as SwaggerRequest;
  const headers = req.get('headers') as
    { toJS: () => Record<string, string> } | undefined;
  return {
    url: req.get('url') as string,
    method: ((req.get('method') as string) ?? 'GET').toUpperCase(),
    headers: headers?.toJS?.() ?? {},
    body: req.get('body') as string | undefined,
  };
};

const requestSnippetGenerator_node_native = (request: unknown): string => {
  const { url, method, headers, body } = parseRequest(request);

  const options: Record<string, unknown> = { method, redirect: 'follow' };
  if (Object.keys(headers).length > 0) options.headers = headers;
  if (body) options.body = body;

  return [
    `const res = await fetch(${JSON.stringify(url)}, ${JSON.stringify(
      options,
      null,
      2,
    )});`,
    `const data = await res.json();`,
    `console.log(data);`,
  ].join('\n');
};

const requestSnippetGenerator_python = (request: unknown): string => {
  const { url, method, headers, body } = parseRequest(request);
  const lines = ['import requests', '', `url = ${JSON.stringify(url)}`];

  const args = [`url`, 'allow_redirects=True'];
  if (Object.keys(headers).length > 0) {
    const entries = Object.entries(headers)
      .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
      .join('\n');
    lines.push('', `headers = {\n${entries}\n}`);
    args.push('headers=headers');
  }
  if (body) {
    lines.push('', `data = ${JSON.stringify(body)}`);
    args.push('data=data');
  }

  lines.push(
    '',
    `response = requests.${method.toLowerCase()}(${args.join(', ')})`,
    `print(response.json())`,
  );
  return lines.join('\n');
};

const requestSnippetGenerator_ruby = (request: unknown): string => {
  const { url, method, headers, body } = parseRequest(request);
  const klass = method.charAt(0) + method.slice(1).toLowerCase();
  const lines = [
    `require 'net/http'`,
    `require 'uri'`,
    `require 'json'`,
    '',
    `# net/http does not follow redirects, so do it manually.`,
    `def send_request(uri, limit = 10)`,
    `  raise 'Too many redirects' if limit == 0`,
    '',
    `  request = Net::HTTP::${klass}.new(uri)`,
  ];

  for (const [k, v] of Object.entries(headers)) {
    lines.push(`  request[${JSON.stringify(k)}] = ${JSON.stringify(v)}`);
  }
  if (body) lines.push(`  request.body = ${JSON.stringify(body)}`);

  lines.push(
    '',
    `  response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|`,
    `    http.request(request)`,
    `  end`,
    '',
    `  if response.is_a?(Net::HTTPRedirection)`,
    `    return send_request(URI(response['location']), limit - 1)`,
    `  end`,
    '',
    `  response`,
    `end`,
    '',
    `response = send_request(URI(${JSON.stringify(url)}))`,
    `puts JSON.parse(response.body)`,
  );
  return lines.join('\n');
};

const requestSnippetGenerator_php = (request: unknown): string => {
  const { url, method, headers, body } = parseRequest(request);
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `    ${JSON.stringify(`${k}: ${v}`)},`)
    .join('\n');

  const lines = [
    '<?php',
    '',
    `$ch = curl_init(${JSON.stringify(url)});`,
    '',
    `curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);`,
    `curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);`,
    `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${JSON.stringify(method)});`,
  ];
  if (Object.keys(headers).length > 0) {
    lines.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, [\n${headerLines}\n]);`);
  }
  if (body) {
    lines.push(
      `curl_setopt($ch, CURLOPT_POSTFIELDS, ${JSON.stringify(body)});`,
    );
  }
  lines.push(
    '',
    `$response = curl_exec($ch);`,
    `curl_close($ch);`,
    '',
    `echo $response;`,
  );
  return lines.join('\n');
};

const addFollowRedirectsFlag = (system: SwaggerSystem) => {
  const original = system.fn.requestSnippetGenerator_curl_bash;
  return {
    fn: {
      requestSnippetGenerator_curl_bash: (request: unknown) =>
        original(request).replace(/^curl /, 'curl -L '),
      requestSnippetGenerator_node_native,
      requestSnippetGenerator_python,
      requestSnippetGenerator_ruby,
      requestSnippetGenerator_php,
    },
  };
};

const interceptResponse: NonNullable<SwaggerUIProps['responseInterceptor']> = (
  res,
) => {
  const mutableResponse = res as unknown as MutableSwaggerResponse;
  const isRedirect =
    mutableResponse.status === 0 ||
    mutableResponse.type === 'opaqueredirect' ||
    (mutableResponse.status >= 300 && mutableResponse.status < 400);

  if (isRedirect) {
    mutableResponse.ok = true; // stop Swagger UI treating it as a failed request
    mutableResponse.status = mutableResponse.status || 302;
    mutableResponse.statusText = 'Redirect intercepted (not followed)';
    mutableResponse.headers['content-type'] = 'application/json';

    const location =
      mutableResponse.headers.location ||
      mutableResponse.headers.Location ||
      'unknown (opaque response — cross-origin redirect)';
    const responseBody = {
      message:
        'Redirects are not followed in the playground - please check using curl or your own HTTP client.',
      location,
    };
    const body = JSON.stringify(responseBody);

    mutableResponse.text = body;
    mutableResponse.data = body;
    mutableResponse.obj = responseBody;
  }
  return res;
};

const MAJOR_LABEL: Record<ReturnType<typeof majorStatus>, string> = {
  current: '',
  frozen: ' (frozen)',
  pending: ' (not yet current)',
};

export default function Playground(): React.ReactElement {
  const [major, setMajor] = useState<ApiMajor>(LATEST_API_MAJOR);

  return (
    <>
      {API_MAJORS.length > 1 && (
        <nav className="api-major-switcher" aria-label="API version">
          {API_MAJORS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setMajor(candidate)}
              aria-current={candidate === major}
              className={candidate === major ? 'is-selected' : undefined}
            >
              {candidate}
              {MAJOR_LABEL[majorStatus(candidate)]}
            </button>
          ))}
        </nav>
      )}
      <SwaggerUI
        // Remounts on change: swagger-ui keeps its spec, deep links and
        // try-it-out state in a store that does not expect the URL to move.
        key={major}
        url={`/api/${major}/swagger.json`}
        tryItOutEnabled={true}
        requestSnippetsEnabled={true}
        plugins={[addFollowRedirectsFlag]}
        requestInterceptor={(req) => {
          req.redirect = 'manual';
          return req;
        }}
        deepLinking={true}
        requestSnippets={{
          generators: {
            curl_bash: { title: 'cURL (bash)', syntax: 'bash' },
            node_native: { title: 'Node.js', syntax: 'javascript' },
            python: { title: 'Python', syntax: 'python' },
            ruby: { title: 'Ruby', syntax: 'ruby' },
            php: { title: 'PHP', syntax: 'php' },
          },
          languages: ['curl_bash', 'node_native', 'python', 'ruby', 'php'],
        }}
        responseInterceptor={interceptResponse}
      />
    </>
  );
}
