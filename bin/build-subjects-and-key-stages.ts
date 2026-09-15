import 'renvy';
import { LATEST_API_MAJOR } from '@/lib/apiVersion';

import { promises as fs } from 'node:fs';
import type { SourceRecord } from '@/lib/keyStageAndSubjects';

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { SubjectResult } from '@/lib/handlers/subjects/types';
const __dirname = dirname(fileURLToPath(import.meta.url));

const port = process.env.PORT || '2727';

if (!port) {
  throw new Error('PORT env is not defined - required to complete the build');
}

const key = process.env.API_KEY;

if (!key) {
  throw new Error(
    'API_KEY env is not defined - required to complete the build',
  );
}

const subjectsRes = await fetch(
  `http://localhost:${port}/api/${LATEST_API_MAJOR}/subjects`,
  {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  },
);

let subjectSlugs: string[];

try {
  subjectSlugs = (await subjectsRes.json()) as string[];
} catch {
  console.log(
    'Failed to fetch subject slugs from the API, please ensure the API is running and the API_KEY is correct',
  );
  process.exit(1);
}

// Fetch full subject data for each slug to get keystage info
const subjectsData: SubjectResult[] = [];
for (const slug of subjectSlugs) {
  const res = await fetch(
    `http://localhost:${port}/api/${LATEST_API_MAJOR}/subjects/${slug}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    },
  );

  if (!res.ok) {
    console.warn(`Failed to fetch subject data for ${slug}`);
    continue;
  }

  try {
    const data = (await res.json()) as SubjectResult;
    subjectsData.push(data);
  } catch {
    console.warn(`Failed to parse subject data for ${slug}`);
  }
}

// map(.keyStages | map({ slug: .keyStageSlug, title: .keyStageTitle })) | flatten | unique

const result: SourceRecord[] = subjectsData
  .flatMap((item) =>
    item.keyStages.map(({ keyStageSlug: slug, keyStageTitle: title }) => ({
      slug,
      title,
      subjects: [],
    })),
  )
  .filter(
    (v, i, arr) =>
      arr.findIndex((o) => o.slug === v.slug && o.title === v.title) === i,
  );

// for each keystage, find the subjects that are taught at that key stage
for (const { slug } of result) {
  const subjects = subjectsData
    .filter((item) => item.keyStages.some((ks) => ks.keyStageSlug === slug))
    .map((item) => ({ slug: item.subjectSlug, title: item.subjectTitle }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // add the subjects to the key stage
  const resultEntry = result.find((v) => v.slug === slug);
  if (resultEntry) {
    resultEntry.subjects = subjects;
  }
}

await fs.writeFile(
  resolve(__dirname, '..', 'src', 'lib', 'keyStageAndSubjects.json'),
  JSON.stringify(result, null, 2),
);
