'use client';
import {
  OakBox,
  OakFlex,
  OakGrid,
  OakGridArea,
  OakHeading,
  OakImage,
  OakLink,
  OakMaxWidth,
  OakP,
  OakPrimaryButton,
  OakSecondaryButton,
  OakTagFunctional,
} from '@oaknational/oak-components';

import styled from 'styled-components';

export default function Hero(): React.ReactElement {
  return (
    <OakBox $background="bg-decorative1-main" $color="text-primary">
      <OakMaxWidth
        $ph={'spacing-16'}
        $flexDirection={'row'}
        $pv="spacing-64"
        // FIXME: styles are being overwritten somewhere so having
        // to declare this.
        $mh={'auto'}
        $maxWidth={['spacing-480', 'spacing-1280']}
      >
        <OakGrid $cg="spacing-24" $rg="spacing-24">
          <OakGridArea $colSpan={[12, 7]} $flexDirection={'column'}>
            <OakTagFunctional
              label="Beta"
              $width="fit-content"
              $background="bg-decorative1-subdued"
              $borderRadius="border-radius-xl"
              $pv="spacing-8"
              $ph="spacing-12"
              $font={'body-3-bold'}
            />

            <OakHeading $mv={'spacing-24'} $font="heading-3" tag="h2">
              Access high-quality education content with the Oak Curriculum API
            </OakHeading>

            <OakP $mb={'spacing-48'} $color="text-primary" $font="body-2">
              We’re offering a free API to share our high-quality educational
              content with the broader education community, all under the{' '}
              <OakLink
                href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                target="_blank"
              >
                Open Government Licence
              </OakLink>
              .
            </OakP>
            <OakFlex $gap={'spacing-16'}>
              <AlignFixButton
                element="a"
                href="https://share.hsforms.com/1gQQFsrHDRf-eZUDajj6NzQbvumd"
              >
                Request an API key
              </AlignFixButton>

              <OakPrimaryButton
                element="a"
                href="/playground"
                isTrailingIcon={true}
              >
                Visit OpenAPI playground
              </OakPrimaryButton>
            </OakFlex>
          </OakGridArea>
          <OakGridArea $display={['none', 'block']} $colSpan={[12, 5]}>
            <OakFlex>
              <OakImage
                sizes="width: 2228px, height: 1472px"
                priority={true}
                src={{
                  src: '/images/workers.png',
                  width: 2228,
                  height: 1472,
                }}
                alt=""
                $height="spacing-360"
              />
            </OakFlex>
          </OakGridArea>
        </OakGrid>
      </OakMaxWidth>
    </OakBox>
  );
}

const AlignFixButton = styled(OakSecondaryButton)`
  a {
    display: inline-flex;

    align-items: center;
    font-size: 2rem;
  }
`;
