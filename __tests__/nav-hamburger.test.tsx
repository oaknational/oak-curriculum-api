import { expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ServerStyleSheet } from 'styled-components';
import { OakThemeProvider, oakDefaultTheme } from '@oaknational/oak-components';

import { Navigation } from '@/components/Nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

/**
 * A rule hiding a `span`, whether by element or as the subject of a descendant
 * selector. oak-components renders button icons as a `span`, so such a rule
 * takes the hamburger with it.
 */
const hidesASpan = /(?:^|[\s>+~,])span\s*\{[^}]*display:\s*none/;

const render = (element: React.ReactElement) => {
  const sheet = new ServerStyleSheet();
  const html = renderToString(
    sheet.collectStyles(
      <OakThemeProvider theme={oakDefaultTheme}>{element}</OakThemeProvider>,
    ),
  );
  const css = sheet.getStyleTags();
  sheet.seal();
  return { html, css };
};

it('gives the narrow-viewport menu a labelled hamburger button', () => {
  const { html } = render(<Navigation />);

  // The button has no text, so aria-label is its only accessible name.
  expect(html).toContain('aria-label="Open menu"');
  expect(html).toContain('aria-expanded="false"');
});

it('leaves the hamburger icon visible', () => {
  // Below the 1280px breakpoint this button is the only way into the menu, and
  // hiding its icon silently collapses it to nothing.
  const { html, css } = render(<Navigation />);

  expect(html).toMatch(/aria-label="Open menu"[\s\S]*?<img/);
  expect(css).not.toMatch(hidesASpan);
});
