import styled from 'styled-components';
import { OakJauntyAngleLabel as _OakJauntyAngleLabel } from '@oaknational/oak-components';

interface JauntyAngleLabelProps {
  $y?: string;
  $clickThrough?: boolean;
  $error?: boolean;
}

export const JauntyAngleLabel = styled(
  _OakJauntyAngleLabel,
)<JauntyAngleLabelProps>`
  width: fit-content;
  background: #ffe555;
  border-radius: 0;
  z-index: 10;
  cursor: pointer;
  position: absolute;
  padding: 4px 8px;
  transform: rotate(-1.5deg)
    translateY(${(props: JauntyAngleLabelProps) => props.$y || '-15px'})
    translateX(8px);

  ${(props: JauntyAngleLabelProps) =>
    props.$clickThrough && `pointer-events: none;`}

  strong {
    font-weight: 600;
  }

  ${(props: JauntyAngleLabelProps) =>
    props.$error &&
    `
    background: #dd0035;
    color: white;`}

  &:has(+ div input:not(:placeholder-shown):invalid) {
    background: #dd0035;
    color: white;
  }
`;
