import { OakLoadingSpinner } from '@oaknational/oak-components';
import styled, { keyframes } from 'styled-components';

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
`;

/**
 * oak-components draws the spinner ring with an unprefixed `::after`. Under
 * styled-components@6 that compiles to `.spinner ::after` — a descendant
 * selector — so the ring only ever lands on the visually hidden "Loading"
 * text and nothing is drawn. Re-declaring it as `&::after` puts it back on
 * the span itself. The `--width` custom properties it reads are still set by
 * oak-components, so `$width` and the other spinner props keep working.
 *
 * oaknational/oak-components#770 replaces the pseudo-element with a real child
 * element. Delete this file and import OakLoadingSpinner directly once that
 * ships — leaving it in place would draw a second ring.
 */
export const LoadingSpinner = styled(OakLoadingSpinner)`
  &::after {
    content: ' ';
    display: block;
    width: var(--inner-width);
    height: var(--inner-width);
    margin: var(--thickness);
    border-radius: 50%;
    border: var(--thickness) solid currentcolor;
    border-color: currentcolor currentcolor currentcolor transparent;
    animation: ${spin} 1.2s linear infinite;
  }
`;
