'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  OakBox,
  OakFlex,
  OakTextInput as _OakTextInput,
  OakFieldError,
  OakP,
  OakHeading,
  OakLink,
  OakLI,
  OakLabel,
  OakUL,
} from '@oaknational/oak-components';
import { JauntyAngleLabel } from '../JauntyAngleLabel';
import CheckBox from '../CheckBox';
import styled from 'styled-components';
import { ButtonWithSpinner } from '../ButtonWithSpinner';
import { useStableId } from '@/lib/useStableId';
import { LATEST_API_MAJOR } from '@/lib/apiVersion';

interface AuthenticateProps {
  hasSelectedSubject: () => boolean;
  setHasError: (hasError: boolean) => void;
  selectedSubjects: Record<string, { primary: boolean; secondary: boolean }>;
}

const ErrorUL = styled(OakUL)`
  list-style-type: disc;
  margin: 0;
  padding-left: 1.5rem;

  li {
    display: list-item;
  }
`;

const OakTextInput = styled(_OakTextInput)`
  padding: 16px 0;
  height: fit-content;
`;

async function startDownload(
  selectedSubjectKeys: string[],
  apiKey: string,
  done: (ok: boolean) => undefined,
): Promise<void> {
  const res = await fetch('/api/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ subjects: selectedSubjectKeys }),
  });

  const stream = res.body;

  if (!stream || res.status !== 200) {
    console.error('No response stream available');
    done(false);
    return;
  }

  try {
    const downloadStream = new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();

        async function push(): Promise<void> {
          await reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(value);
            return push();
          });
        }

        await push();
      },
    });

    const blob = new Response(downloadStream);
    const url = URL.createObjectURL(await blob.blob());

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `oak-bulk-download-${new Date().toISOString()}.zip`;
    a.click();

    // Optional: revoke after some time
    setTimeout(() => {
      URL.revokeObjectURL(url);
      done(true);
    }, 2_000);
  } catch (error) {
    console.error('Error during download:', error);
    done(false);
  }
}

export function Authenticate({
  hasSelectedSubject,
  setHasError,
  selectedSubjects,
}: AuthenticateProps): React.ReactElement {
  const [apiKey, setApiKey] = useState('');
  const [termsChecked, setTermsChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [apiKeyError, setApiKeyError] = useState<boolean | string>(false);
  const [termsError, setTermsError] = useState<boolean | string>(false);
  const [subjectError, setSubjectError] = useState<boolean | string>(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!apiKeyError && !termsError && !subjectError) {
      setHasError(false);
      setErrorMessage('');
    }
  }, [apiKeyError, termsError, subjectError, setHasError]);

  const handleDownload = async (): Promise<void> => {
    setIsLoading(true);
    let hasError = false;

    if (!termsChecked) {
      setTermsError('Accept terms and conditions to continue');
      hasError = true;
    } else {
      setTermsError(false);
    }

    if (!hasSelectedSubject()) {
      setSubjectError('Select at least one subject to download');
      hasError = true;
      setHasError(true);
    } else {
      setSubjectError(false);
      setHasError(false);
    }

    if (!apiKey) {
      setApiKeyError('Enter a valid API key to continue');
      hasError = true;
    } else {
      if (hasError) {
        setApiKeyError(false);
      } else {
        // don't bother with API check if we haven't passed the initial checks
        const res = await fetch(`/api/${LATEST_API_MAJOR}/rate-limit`, {
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!res.ok) {
          setApiKeyError('Enter a valid API key to continue');
          hasError = true;
        } else {
          setApiKeyError(false);
        }
      }
    }

    if (hasError) {
      setErrorMessage('To complete, correct the following:');
      setIsLoading(false);
      return;
    }

    setErrorMessage('');

    // construct an array of selected subjects as ${subjectSlug}-${phase}
    const selectedSubjectKeys = Object.keys(selectedSubjects)
      .filter(
        (key) =>
          selectedSubjects[key].primary || selectedSubjects[key].secondary,
      )
      .reduce<string[]>((acc, key) => {
        if (selectedSubjects[key].primary) {
          acc.push(`${key}-primary`);
        }
        if (selectedSubjects[key].secondary) {
          acc.push(`${key}-secondary`);
        }
        return acc;
      }, []);

    await startDownload(selectedSubjectKeys, apiKey, (ok) => {
      setIsLoading(false);
      if (ok) {
        router.push('/bulk-download/success');
      }
      return;
    });

    // Mock API fetch here
  };

  const termsId = useStableId('terms');
  const termsErrorId = useStableId('terms-error');
  const termsLabelId = useStableId('terms-label');
  const apiKeyId = useStableId('api-key');
  const apiKeyErrorId = useStableId('api-key-error');
  const apiKeyLabelId = useStableId('api-key-label');

  return (
    <OakFlex
      $gap="spacing-32"
      $flexDirection="column"
      $maxWidth={['auto', '460px']}
    >
      <OakHeading tag="h2" $font="heading-4">
        Authenticate
      </OakHeading>
      <OakBox>
        {apiKeyError && (
          <OakBox id={apiKeyErrorId} $mb="spacing-24">
            <OakFieldError>{apiKeyError}</OakFieldError>
          </OakBox>
        )}
        <JauntyAngleLabel
          id={apiKeyLabelId}
          $error={!!apiKeyError}
          $background="lemon"
          htmlFor={apiKeyId}
          as="label"
        >
          <strong>API Key</strong>{' '}
          <span style={{ fontWeight: 400 }}>(required)</span>
        </JauntyAngleLabel>
        <OakTextInput
          id={apiKeyId}
          type="text"
          $pa="spacing-16"
          placeholder="Enter your API key"
          value={apiKey}
          aria-labelledby={apiKeyLabelId}
          aria-describedby={apiKeyError ? apiKeyErrorId : undefined}
          aria-invalid={!!apiKeyError}
          required
          onChange={(e) => {
            setApiKeyError(false);
            setApiKey(e.target.value);
          }}
        />
        <OakP $mt="spacing-16">
          You will need to authorise yourself with an API key to download
          resources. You can request an API key, or find out more about API
          keys.
        </OakP>
      </OakBox>
      <OakBox>
        {termsError && (
          <OakBox id={termsErrorId} $mb="spacing-24">
            <OakFieldError>{termsError}</OakFieldError>
          </OakBox>
        )}
        <CheckBox
          id={termsId}
          checked={termsChecked}
          onChange={setTermsChecked}
          $hasError={!!termsError}
          aria-invalid={!!termsError}
          aria-describedby={termsError ? termsErrorId : undefined}
          labelId={termsLabelId}
          required
        >
          <OakLabel $font="heading-light-7" htmlFor={termsId} id={termsLabelId}>
            I accept{' '}
            <OakLink
              target="_blank"
              href="https://www.thenational.academy/legal/terms-and-conditions-api-version"
            >
              Oak's terms and conditions
            </OakLink>{' '}
            (required)
          </OakLabel>
        </CheckBox>
      </OakBox>
      {errorMessage && (
        <OakBox $mt="spacing-16">
          <OakFieldError>
            <OakP>{errorMessage}</OakP>
            <ErrorUL $mt="spacing-0">
              {subjectError && <OakLI>{subjectError}</OakLI>}
              {apiKeyError && <OakLI>{apiKeyError}</OakLI>}
              {termsError && <OakLI>{termsError}</OakLI>}
            </ErrorUL>
          </OakFieldError>
        </OakBox>
      )}
      <OakBox>
        <ButtonWithSpinner
          isLoading={isLoading}
          isTrailingIcon={true}
          onClick={handleDownload}
        >
          {isLoading ? 'Preparing your zip' : 'Download'}
        </ButtonWithSpinner>
      </OakBox>
    </OakFlex>
  );
}
