import { useStableId } from '@/lib/useStableId';
import { useState, type InputHTMLAttributes } from 'react';
import styled from 'styled-components';

interface CheckBoxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  $hasError?: boolean;
  id?: string;
  labelId?: string;
  children?: React.ReactNode;
}

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px; /* Space between checkbox and label */
  cursor: pointer;
`;

const HiddenCheckbox = styled.input.attrs({ type: 'checkbox' })`
  // Hide checkbox visually but allow it to be tabbed and clicked
  border: 0;
  clip: rect(0 0 0 0);
  clippath: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

const StyledCheckbox = styled.div<{ $checked: boolean; $hasError?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 2px;
  border: 2px solid #808080; /* oak color: grey50 */
  background: #fff; /* oak color: white */
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 150ms;

  ${HiddenCheckbox}:focus + & {
    box-shadow: 0 0 0 3px lightblue;
  }

  ${(props) =>
    props.$checked &&
    `
    background: #222; /* New background when checked */
    border-color: #CACACA;
  `}

  ${(props) =>
    props.$hasError &&
    `
    border-color: red; /* Example error color */
  `}
`;

const Label = styled.label`
  font-size: 16px;
  color: #333; /* Example label color */
  cursor: pointer;
`;

const CheckMarkIcon = (): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none">
    <path
      fill="#fff"
      fillRule="evenodd"
      d="M16.747 4.72a1.247 1.247 0 0 1 .518 1.706 5.215 5.215 0 0 1-.52.888c-.476.62-.84 1.32-1.256 2.114-.113.217-.23.441-.354.673-.203.377-.407.79-.621 1.222-.557 1.121-1.175 2.367-1.966 3.435-.664.896-1.6 1.933-2.811 2.519a1.49 1.49 0 0 1-.488.135 1.938 1.938 0 0 1-.666-.046 1.443 1.443 0 0 1-.45-.198l-.017-.009a1.524 1.524 0 0 1-.524-.37 1.924 1.924 0 0 1-.155-.192 3.587 3.587 0 0 1-.718-.758 10.793 10.793 0 0 1-.297-.429 8.589 8.589 0 0 0-.158-.231c-.127-.176-.27-.364-.42-.564-.543-.715-1.192-1.572-1.613-2.531-.273-.623 0-1.354.61-1.633.612-.278 1.328 0 1.601.624.292.666.697 1.202 1.198 1.865.18.238.372.493.576.776.07.097.144.208.207.302l.026.04c.075.11.141.208.208.299.066.09.12.156.164.202a.578.578 0 0 0 .041.04c.104.064.189.134.257.2.532-.365 1.036-.91 1.496-1.53.655-.884 1.114-1.812 1.627-2.846.236-.478.483-.978.767-1.507.093-.174.19-.36.29-.553.425-.816.918-1.764 1.538-2.572.077-.1.151-.246.285-.518a1.2 1.2 0 0 1 1.625-.553Z"
    />
  </svg>
);

const CheckBox: React.FC<CheckBoxProps> = ({
  checked: controlledChecked,
  onChange: controlledOnChange,
  label = '',
  $hasError,
  children,
  id: idProp,
  labelId: labelIdProp,
  // need to add `props` to allow for additional props to be passed down
  // that are valid for a checkbox input
  ...props
}): React.ReactElement => {
  const [internalChecked, setInternalChecked] = useState(false);

  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : internalChecked;

  const id = idProp ?? useStableId('chk');
  const labelId = labelIdProp ?? useStableId('lbl');

  const handleCheckboxChange = (): void => {
    const newCheckedState = !checked;
    if (isControlled && controlledOnChange) {
      controlledOnChange(newCheckedState);
    } else {
      setInternalChecked(newCheckedState);
    }
  };

  return (
    <CheckboxContainer>
      <HiddenCheckbox
        {...props}
        id={id}
        checked={checked}
        onChange={handleCheckboxChange}
        aria-labelledby={label ? labelId : undefined}
      />
      <StyledCheckbox
        aria-hidden
        onClick={handleCheckboxChange}
        $checked={checked}
        $hasError={$hasError}
      >
        {checked && <CheckMarkIcon />}
      </StyledCheckbox>
      {label && (
        <Label id={labelId} htmlFor={id}>
          {label}
        </Label>
      )}
      {children}
    </CheckboxContainer>
  );
};

export default CheckBox;
