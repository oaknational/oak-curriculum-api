'use client';

import {
  OakBackLink,
  OakBox,
  OakFieldError,
  OakFlex,
  OakHeading,
  OakInlineBanner,
  OakLabel,
  OakLI,
  OakP,
  OakSecondaryButton,
  OakTagFunctional,
  OakTextInput,
  OakUL,
} from '@oaknational/oak-components';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { ButtonWithSpinner } from '@/components/ButtonWithSpinner';
import { CopyButton } from '@/components/CopyButton';
import { useStableId } from '@/lib/useStableId';
import type { AdminUsage, AdminUser } from '@/app/api/admin/schemas';
import { AdminApiError, getUser, rollKey, updateUser } from './api';
import { KeyValue } from './KeyValue';
import {
  EMPTY,
  formatDateTime,
  formatNumber,
  formatRateLimit,
  isUnlimited,
  rateLimitHint,
  withoutIssue,
} from './format';
import { RollKeyModal } from './RollKeyModal';

const DescriptionList = styled(OakBox)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  margin: 0;
`;

function toFormValues(user: AdminUser): Record<string, string> {
  return {
    name: user.name ?? '',
    company: user.company ?? '',
    email: user.email ?? '',
    rateLimit: String(user.rateLimit),
  };
}

export function UserDetail({ id }: { id: number }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editing = searchParams.get('mode') === 'edit';

  const [user, setUser] = useState<AdminUser | null>(null);
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const [rollOpen, setRollOpen] = useState(false);
  const [rolledKey, setRolledKey] = useState('');

  const nameId = useStableId('name');
  const companyId = useStableId('company');
  const emailId = useStableId('email');
  const rateLimitId = useStableId('rate-limit');
  const rateLimitHintId = useStableId('rate-limit-hint');

  useEffect(() => {
    let cancelled = false;

    getUser(id)
      .then((result) => {
        if (cancelled) return;
        setUser(result.user);
        setUsage(result.usage);
        setForm(toFormValues(result.user));
      })
      .catch((caught) => {
        if (cancelled) return;
        setLoadError(
          caught instanceof AdminApiError && caught.status === 404
            ? 'That user does not exist.'
            : 'Could not load this user. Please try again.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const setMode = useCallback(
    (mode: 'view' | 'edit') => {
      router.replace(mode === 'edit' ? `${pathname}?mode=edit` : pathname);
    },
    [pathname, router],
  );

  const set = (field: string, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
    setIssues((current) => withoutIssue(current, field));
  };

  const handleSave = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!user) return;

    // Only send what actually changed. This is safe because updateUser applies
    // a partial update rather than rewriting the whole record.
    const original = toFormValues(user);
    const changed: Record<string, string | number> = {};

    for (const [field, value] of Object.entries(form)) {
      if (value !== original[field]) {
        changed[field] = field === 'rateLimit' ? Number(value) : value;
      }
    }

    if (Object.keys(changed).length === 0) {
      setMode('view');
      return;
    }

    setSaving(true);
    setSaveError('');
    setIssues({});

    try {
      const result = await updateUser(id, changed);
      setUser(result.user);
      setForm(toFormValues(result.user));
      setNotice('Changes saved.');
      setMode('view');
    } catch (caught) {
      if (caught instanceof AdminApiError) {
        setSaveError(caught.message);
        setIssues(
          Object.fromEntries(
            caught.issues.map((issue) => [issue.path, issue.message]),
          ),
        );
      } else {
        setSaveError('Could not reach the server. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRoll = async (): Promise<void> => {
    const result = await rollKey(id);
    setUser(result.user);
    setForm(toFormValues(result.user));
    setRolledKey(result.user.key);
    setRollOpen(false);
  };

  if (loading) {
    return (
      <OakFlex $justifyContent="center" $pv="spacing-48">
        <LoadingSpinner />
      </OakFlex>
    );
  }

  if (loadError || !user) {
    return (
      <>
        <OakBackLink href="/admin/users" label="All users" />
        <OakBox $mt="spacing-24">
          <OakInlineBanner
            isOpen
            type="error"
            title="Not available"
            message={loadError}
          />
        </OakBox>
      </>
    );
  }

  return (
    <>
      <OakBackLink href="/admin/users" label="All users" />

      <OakFlex
        $alignItems={['flex-start', 'center']}
        $flexDirection={['column', 'row']}
        $gap="spacing-16"
        $mt="spacing-16"
        $mb="spacing-24"
      >
        <OakHeading tag="h2" $font="heading-4">
          {user.name ?? `User ${user.id}`}
        </OakHeading>
        {isUnlimited(user.rateLimit) && <OakTagFunctional label="Unlimited" />}
      </OakFlex>

      {notice && (
        <OakBox $mb="spacing-24">
          <OakInlineBanner
            isOpen
            type="success"
            title="Saved"
            message={notice}
            canDismiss
            onDismiss={() => setNotice('')}
          />
        </OakBox>
      )}

      {rolledKey && (
        <OakBox $mb="spacing-24">
          <OakInlineBanner
            isOpen
            type="success"
            title="New API key issued"
            message="The previous key no longer works. Copy the new key below and send it to the user."
          />
        </OakBox>
      )}

      {editing ? (
        <>
          {saveError && (
            <OakBox $mb="spacing-24">
              <OakFieldError>
                <OakP>{saveError}</OakP>
                {Object.keys(issues).length > 0 && (
                  <OakUL $mt="spacing-8">
                    {Object.entries(issues).map(([path, message]) => (
                      <OakLI key={path}>{message}</OakLI>
                    ))}
                  </OakUL>
                )}
              </OakFieldError>
            </OakBox>
          )}

          <OakFlex
            as="form"
            noValidate
            $flexDirection="column"
            $gap="spacing-24"
            $maxWidth="spacing-640"
            onSubmit={handleSave}
          >
            <div>
              <OakBox $mb="spacing-8">
                <OakLabel htmlFor={nameId}>Individual&apos;s name</OakLabel>
              </OakBox>
              <OakTextInput
                $pv="spacing-0"
                wrapperWidth="100%"
                $height="spacing-40"
                id={nameId}
                name="name"
                value={form.name ?? ''}
                validity={issues.name ? 'invalid' : undefined}
                aria-invalid={issues.name ? true : undefined}
                onChange={(event) => set('name', event.target.value)}
              />
              {issues.name && <OakFieldError>{issues.name}</OakFieldError>}
            </div>

            <div>
              <OakBox $mb="spacing-8">
                <OakLabel htmlFor={companyId}>Company</OakLabel>
              </OakBox>
              <OakTextInput
                $pv="spacing-0"
                wrapperWidth="100%"
                $height="spacing-40"
                id={companyId}
                name="company"
                value={form.company ?? ''}
                validity={issues.company ? 'invalid' : undefined}
                aria-invalid={issues.company ? true : undefined}
                onChange={(event) => set('company', event.target.value)}
              />
              {issues.company && (
                <OakFieldError>{issues.company}</OakFieldError>
              )}
            </div>

            <div>
              <OakBox $mb="spacing-8">
                <OakLabel htmlFor={emailId}>Email address</OakLabel>
              </OakBox>
              <OakTextInput
                $pv="spacing-0"
                wrapperWidth="100%"
                $height="spacing-40"
                id={emailId}
                name="email"
                type="email"
                value={form.email ?? ''}
                validity={issues.email ? 'invalid' : undefined}
                aria-invalid={issues.email ? true : undefined}
                onChange={(event) => set('email', event.target.value)}
              />
              {issues.email && <OakFieldError>{issues.email}</OakFieldError>}
            </div>

            <div>
              <OakLabel htmlFor={rateLimitId}>Rate limit</OakLabel>
              <OakP id={rateLimitHintId} $font="body-3" $color="text-subdued">
                {rateLimitHint}
              </OakP>
              <OakTextInput
                $pv="spacing-0"
                wrapperWidth="100%"
                $height="spacing-40"
                id={rateLimitId}
                name="rateLimit"
                type="number"
                min={0}
                value={form.rateLimit ?? ''}
                aria-describedby={rateLimitHintId}
                validity={issues.rateLimit ? 'invalid' : undefined}
                aria-invalid={issues.rateLimit ? true : undefined}
                onChange={(event) => set('rateLimit', event.target.value)}
              />
              {issues.rateLimit && (
                <OakFieldError>{issues.rateLimit}</OakFieldError>
              )}
            </div>

            <OakFlex $gap="spacing-16">
              <ButtonWithSpinner
                type="submit"
                isLoading={saving}
                disabled={saving}
              >
                {saving ? 'Saving' : 'Save changes'}
              </ButtonWithSpinner>
              <OakSecondaryButton
                type="button"
                onClick={() => {
                  setForm(toFormValues(user));
                  setIssues({});
                  setSaveError('');
                  setMode('view');
                }}
              >
                Cancel
              </OakSecondaryButton>
            </OakFlex>
          </OakFlex>
        </>
      ) : (
        <>
          <DescriptionList as="dl">
            <KeyValue label="ID" value={user.id} />
            <KeyValue label="Name" value={user.name ?? EMPTY} />
            <KeyValue label="Company" value={user.company ?? EMPTY} />
            <KeyValue label="Email" value={user.email ?? EMPTY} />
            <KeyValue
              label="Rate limit"
              value={formatRateLimit(user.rateLimit)}
            />
            <KeyValue label="Created" value={formatDateTime(user.createdAt)} />
            <KeyValue
              label="Last updated"
              value={formatDateTime(user.updatedAt)}
            />
            <KeyValue label="API key" value={user.key} monospace>
              <CopyButton value={user.key} label="Copy key" />
            </KeyValue>
          </DescriptionList>

          <OakHeading
            tag="h3"
            $font="heading-6"
            $mt="spacing-32"
            $mb="spacing-16"
          >
            Usage
          </OakHeading>
          <DescriptionList as="dl">
            <KeyValue
              label="Requests all time"
              value={formatNumber(user.requests)}
            />
            <KeyValue
              label="Last request"
              value={formatDateTime(user.lastRequest)}
            />
            <KeyValue
              label="Remaining this hour"
              value={
                usage?.isSubjectToRateLimiting && usage.remaining !== null
                  ? `${formatNumber(usage.remaining)} of ${formatNumber(
                      usage.limit ?? 0,
                    )}`
                  : 'Unlimited — no rate-limit window'
              }
            />
            {usage?.isSubjectToRateLimiting && usage.reset !== null && (
              <KeyValue
                label="Window resets"
                value={formatDateTime(new Date(usage.reset).toISOString())}
              />
            )}
          </DescriptionList>

          <OakFlex $gap="spacing-16" $mt="spacing-32" $flexWrap="wrap">
            <ButtonWithSpinner type="button" onClick={() => setMode('edit')}>
              Edit
            </ButtonWithSpinner>
            <OakSecondaryButton type="button" onClick={() => setRollOpen(true)}>
              Regenerate API key
            </OakSecondaryButton>
          </OakFlex>
        </>
      )}

      <RollKeyModal
        isOpen={rollOpen}
        userName={user.name ?? `user ${user.id}`}
        onCloseAction={() => setRollOpen(false)}
        onConfirmAction={handleRoll}
      />
    </>
  );
}
