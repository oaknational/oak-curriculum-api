'use client';

import { OakFlex, OakHeading, OakLink } from '@oaknational/oak-components';
import styled from 'styled-components';

import Logo from '@/components/Logo';

const OakLinkLogo = styled(OakLink)`
  margin: 0;
  padding: 0;

  span {
    color: black;
    display: flex;
  }
`;

export default function Banner(): React.ReactElement {
  return (
    <OakFlex
      as="header"
      $alignItems={'center'}
      $gap={'spacing-56'}
      $pv="spacing-12"
      $ph="spacing-16"
      $bb={'border-solid-m'}
      $color="text-primary"
    >
      <OakLinkLogo
        aria-label="Oak National Academy"
        href="https://www.thenational.academy/"
      >
        <Logo width="104" height="48" />
      </OakLinkLogo>
      <OakHeading ariaHidden tag="h1" $font="heading-6">
        Oak Curriculum API
      </OakHeading>
    </OakFlex>
  );
}
