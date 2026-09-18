import { expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ServerStyleSheet } from 'styled-components';
import { OakLoadingSpinner } from '@oaknational/oak-components';

import { LoadingSpinner } from '@/components/LoadingSpinner';

/** A `::after` attached to the element, rather than to a descendant of it. */
const ringOnElement = /\.[A-Za-z0-9_-]+::after\{content/;

const render = (element: React.ReactElement) => {
  const sheet = new ServerStyleSheet();
  const html = renderToString(sheet.collectStyles(element));
  const css = sheet.getStyleTags();
  sheet.seal();
  return { html, css };
};

it('draws the ring on the spinner itself', () => {
  // styled-components 6 does not infer a leading `&`, so oak-components'
  // unprefixed `::after` only ever reaches a descendant and nothing is drawn.
  expect(render(<OakLoadingSpinner />).css).not.toMatch(ringOnElement);
  expect(render(<LoadingSpinner />).css).toMatch(ringOnElement);
});

it('is still the only thing drawing a ring', () => {
  // oaknational/oak-components#770 swaps the pseudo-element for a real child
  // element. When that lands this fails, and LoadingSpinner should be deleted
  // rather than left to draw a second ring on top of oak-components' own.
  const { html } = render(<OakLoadingSpinner />);
  const children = html.match(/<(?!\/)[a-z]+/g) ?? [];

  expect(children).toEqual(['<span', '<span']); // the spinner and its label
});
