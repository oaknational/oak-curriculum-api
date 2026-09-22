'use client';

import {
  OakBox,
  OakFlex,
  OakHeading,
  OakInlineBanner,
  OakP,
  OakPagination,
  OakSecondaryButton,
  OakTextInput,
} from '@oaknational/oak-components';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStableId } from '@/lib/useStableId';
import type { AdminUser } from '@/app/api/admin/schemas';
import { listUsers } from './api';
import { formatNumber } from './format';
import { UserTable } from './UserTable';

const PAGE_SIZE = 25;

export function UsersList(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useStableId('search');

  const search = searchParams.get('search') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  const [term, setTerm] = useState(search);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep the box in step when the URL changes underneath us (back button).
  useEffect(() => setTerm(search), [search]);

  useEffect(() => {
    let cancelled = false;

    // Listing every user means reading the whole keyspace, so wait for a
    // search term rather than doing it on every visit to this page.
    if (!search) {
      setUsers([]);
      setTotal(0);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    listUsers({ search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setUsers(result.users);
        setTotal(result.total);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load users. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, page]);

  const hrefFor = (nextPage: number): string => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    return query ? `/admin/users?${query}` : '/admin/users';
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <OakHeading tag="h2" $font="heading-4" $mb="spacing-24">
        All users
      </OakHeading>

      <OakFlex
        as="form"
        $alignItems="flex-end"
        $gap="spacing-12"
        $mb="spacing-24"
        $flexWrap="wrap"
        onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const params = new URLSearchParams();
          if (term.trim()) params.set('search', term.trim());
          router.replace(
            params.toString() ? `/admin/users?${params}` : '/admin/users',
          );
        }}
      >
        <OakBox>
          <OakTextInput
            $pv="spacing-0"
            wrapperWidth="100%"
            $height="spacing-40"
            id={searchId}
            name="search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </OakBox>
        <OakSecondaryButton type="submit">Search</OakSecondaryButton>
        {search && (
          <OakSecondaryButton
            type="button"
            onClick={() => router.replace('/admin/users')}
          >
            Clear
          </OakSecondaryButton>
        )}
      </OakFlex>

      {!search ? (
        <OakP $color="text-subdued">
          Search to find a user by name, company, email address, API key or ID.
        </OakP>
      ) : loading ? (
        <OakFlex $justifyContent="center" $pv="spacing-48">
          <LoadingSpinner />
        </OakFlex>
      ) : error ? (
        <OakInlineBanner isOpen type="error" title="Error" message={error} />
      ) : users.length === 0 ? (
        <OakP>No users match that search.</OakP>
      ) : (
        <>
          <OakP $font="body-3" $color="text-subdued" $mb="spacing-12">
            {formatNumber(total)} user{total === 1 ? '' : 's'} matching your
            search
          </OakP>
          <UserTable users={users} />
          {totalPages > 1 && (
            <OakBox $mt="spacing-24">
              <OakPagination
                currentPage={page}
                totalPages={totalPages}
                pageName="users"
                paginationHref="/admin/users"
                nextHref={page < totalPages ? hrefFor(page + 1) : undefined}
                prevHref={page > 1 ? hrefFor(page - 1) : undefined}
                onPageChange={(nextPage: number) =>
                  router.replace(hrefFor(nextPage))
                }
              />
            </OakBox>
          )}
        </>
      )}
    </>
  );
}
