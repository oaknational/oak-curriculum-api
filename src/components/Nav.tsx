'use client';
import styled from 'styled-components';
import { usePathname } from 'next/navigation';

import { OakAPINavigationLink as _OakAPINavigationLink } from './OakAPINavigationLink';
import {
  OakFlex,
  OakSpan,
  OakHeading,
  OakLink,
  OakSecondaryButton,
  OakInformativeModal,
} from '@oaknational/oak-components';

import Logo from '@/components/Logo';
import { useState } from 'react';
import { MaxWidth } from './MaxWidth';

const OakLinkLogo = styled(OakLink)`
  margin: 0;
  padding: 0;

  span {
    display: flex;
  }
`;

const MenuSeparator = styled.hr`
  background: #cacaca;
  height: 1px;
  width: 235px;
  margin: 0;
  border: 0;
`;

const MenuContainer = styled(OakFlex)`
  .menu-contents-wide {
    display: none;
  }

  @media (min-width: 1280px) {
    .menu-contents-wide {
      display: flex;
      flex: 1;
    }

    .menu-contents {
      display: none;
    }
  }
`;

// this is silly, but I don't have access to InternalShadowRoundButton, so the
// padding and border have to be stripped to leave a bare icon. Target the
// inner button rather than descendant spans: oak-components renders the icon
// as a span too, so hiding those hides the hamburger itself.
const HamburgerButton = styled(OakSecondaryButton)`
  button {
    padding: 0;
    border: 0;
  }
`;

export function Navigation(): React.ReactElement {
  return (
    <MenuContainer $bb={'border-solid-s'} $borderColor="grey40">
      <MaxWidth
        as="header"
        $alignItems={'center'}
        $gap={'spacing-48'}
        $pv="spacing-12"
        $ph="spacing-16"
        $color="text-primary"
        $flexDirection={'row'}
      >
        <OakFlex role="list" $gap="spacing-32" $alignItems="center">
          <OakFlex $alignItems="center" $gap="spacing-16">
            <OakLinkLogo href="https://www.thenational.academy/">
              <Logo width="31" height="42" />
            </OakLinkLogo>
            <OakHeading tag="span" $font="heading-6">
              Oak Curriculum API
            </OakHeading>
          </OakFlex>
        </OakFlex>

        <MenuContents className="menu-contents-wide" wide={true} />
        <Menu className="menu-contents">
          <MenuContents wide={false} />
        </Menu>
      </MaxWidth>
    </MenuContainer>
  );
}

interface OakAPINavigationLinkProps {
  children: React.ReactNode;
  role: string;
  href: string;
  className?: string | null | undefined;
  isTrailingIcon?: boolean;
  iconName?: string;
  target?: string;
  $font?: string;
}

function OakAPINavigationLink({
  $font = 'heading-light-7',
  ...props
}: OakAPINavigationLinkProps): React.ReactElement {
  const children = props.children;

  // this is a workaround because the font can't be passed directly to links… apparently
  return (
    <_OakAPINavigationLink {...props}>
      <OakSpan $font={$font}>{children}</OakSpan>
    </_OakAPINavigationLink>
  );
}

const MenuModalWrapper = styled.div`
  & > * {
    width: 375px;

    ${_OakAPINavigationLink} {
      width: fit-content;

      &.selected::after {
        display: none;
      }

      &.selected:hover {
        text-decoration: underline;
      }
    }
  }
`;

function Menu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <OakFlex $flexGrow="1" $justifyContent="end" className={className}>
      <HamburgerButton
        aria-label="Open menu"
        aria-expanded={isOpen}
        iconGap="spacing-0"
        onClick={() => setIsOpen(true)}
        iconName="hamburger"
      />
      <MenuModalWrapper>
        <OakInformativeModal
          isOpen={isOpen}
          isLeftHandSide={false}
          footerSlot={null}
          onClose={() => setIsOpen(false)}
        >
          <OakFlex
            as="nav"
            $gap="spacing-48"
            $pa="spacing-16"
            $flexDirection="column"
            $flexGrow="1"
          >
            {children}
          </OakFlex>
        </OakInformativeModal>
      </MenuModalWrapper>
    </OakFlex>
  );
}

function MenuContents({
  wide,
  className,
}: {
  wide: boolean;
  className?: string;
}): React.ReactElement {
  const flexDirection = wide ? 'row' : 'column';

  const pathname = usePathname();

  const select = (test: boolean): string | null => (test ? 'selected' : null);

  const focusLink = {
    docs: select(pathname.startsWith('/docs')),
    playground: select(pathname.startsWith('/playground')),
    bulkDownload: select(pathname.startsWith('/bulk-download')),
    home: select(pathname === '/'),
  };
  return (
    <OakFlex
      $gap="spacing-32"
      $flexDirection={flexDirection}
      className={className}
      $justifyContent="space-between"
    >
      <OakFlex role="list" $gap="spacing-32" $flexDirection={flexDirection}>
        <OakAPINavigationLink
          role="listitem"
          href="/"
          className={focusLink.home}
        >
          Home
        </OakAPINavigationLink>
        <OakAPINavigationLink
          role="listitem"
          href="/docs"
          className={focusLink.docs}
        >
          Documentation
        </OakAPINavigationLink>
      </OakFlex>
      {wide ? null : <MenuSeparator />}
      <OakFlex role="list" $gap="spacing-32" $flexDirection={flexDirection}>
        <OakAPINavigationLink
          role="listitem"
          href="https://share.hsforms.com/1gQQFsrHDRf-eZUDajj6NzQbvumd"
          isTrailingIcon
          iconName="send"
        >
          Request an API key
        </OakAPINavigationLink>

        <OakAPINavigationLink
          role="listitem"
          href="/playground"
          isTrailingIcon
          iconName="external"
          target="_blank"
        >
          API playground
        </OakAPINavigationLink>

        <OakAPINavigationLink
          role="listitem"
          href="/bulk-download"
          isTrailingIcon
          iconName="external"
          target="_blank"
        >
          Bulk download
        </OakAPINavigationLink>
      </OakFlex>
    </OakFlex>
  );
}
