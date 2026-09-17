# styled-components and oak-components

This repository is on **styled-components 6** and has been for some time —
`sanity` requires it, so there was never a choice. oak-components, however, was
written against styled-components 5 and is only now catching up. The gap between
the two is the reason for the workarounds described below.

## What changed in styled-components 6

v6 swapped stylis 3 for stylis 4, which **no longer infers a leading `&`**.
A selector written bare is now compiled as a _descendant_ selector:

```
::after      ->  .sc-hash ::after       (was .sc-hash::after)
:last-child  ->  .sc-hash :last-child   (was .sc-hash:last-child)
&::before    ->  .sc-hash::before        (unchanged — explicit & still works)
```

Nothing errors. The rule simply stops matching the element it was written for,
so the symptom is always "the style silently does nothing".

The other v6 rules that bite consumers:

- **Custom props must be `$`-prefixed.** v6 forwards every prop to whatever it
  renders, so a non-transient prop whose name happens to be a valid DOM
  attribute (`checked`, `y`, `label`, …) lands on the element. `src/lib/registry.tsx`
  installs a `shouldForwardProp` that filters via `@emotion/is-prop-valid`, but
  that filter only runs for intrinsic elements and only knows about real DOM
  attributes — it is a safety net, not a substitute for prefixing.
- **`as` no longer infers polymorphic prop types.**
- **`first-child` is replaced by `first-of-type`** where the selector targets a
  direct child, because the injected style elements shift the child index.
- styled-components 6 bundles its own types. `@types/styled-components` is for
  v5 only and must not be installed alongside it.

## The oak-components side

[oaknational/oak-components#770](https://github.com/oaknational/oak-components/pull/770)
is the upgrade, and despite how it is often described it moves
**styled-components** to v6, not oak-components to v6. The branch is
`@oaknational/oak-components@3.20.0` and the only package.json change is the
peer range `styled-components >=5.3.11` -> `>=6.3.0`. At the time of writing the
PR is still open, and the latest published oak-components is 3.20.x.

### Live workarounds, and what to delete when 770 ships

oak-components 3.20.x still draws `OakLoadingSpinner`'s ring with an unprefixed
`::after`, so the ring is applied to the visually hidden "Loading" text instead
of the spinner itself and **nothing is drawn**. Two files work around that:

- [`src/components/LoadingSpinner.tsx`](../src/components/LoadingSpinner.tsx) —
  re-declares the ring as `&::after`.
- [`src/components/ButtonWithSpinner.tsx`](../src/components/ButtonWithSpinner.tsx) —
  does the same for the spinner inside `OakPrimaryButton`'s `isLoading` state.

PR 770 replaces the pseudo-element with a real child element. **Both files must
be deleted in the same commit that takes the fix**, or every spinner draws
twice — once from oak-components and once from the override.

Because of that, `@oaknational/oak-components` is pinned to an exact version in
`package.json` and listed under `ignore` in
[`.github/dependabot.yml`](../.github/dependabot.yml). It is bumped by hand.
Without that, 770 would arrive on its own: it is 39 `fix:` commits with no
`feat:` and no breaking-change footer, so it releases as a patch and would land
in Dependabot's `production-minor-and-patch` group — where the test job is
skipped by design and lint cannot see a CSS regression.

### Public prop renames to expect

770 renames these exported props to their transient forms. None of them are used
in this repository today, so the bump itself should be uneventful — but check
again before taking it:

| Component | Before | After |
| --- | --- | --- |
| `OakCheckBox` | `labelGap`, `labelAlignItems` | `$labelGap`, `$labelAlignItems` |
| `OakFocusIndicator` | `dropShadow`, `hoverBackground`, `hoverDropShadow`, `activeDropShadow` | `$dropShadow`, `$hoverBackground`, `$hoverDropShadow`, `$activeDropShadow` |
| `OakQuizCheckBox` | `labelGap`, `labelAlignItems` | `$labelGap`, `$labelAlignItems` |

Additive, not breaking: `OakGrid` gains `$alignItems`, `OakJauntyAngleLabel`
gains `htmlFor`, and `OakImage` starts exporting `StyledImageProps`.

`OakInlineRegistrationBanner` also drops `$top="-15px"` in favour of a styled
wrapper, so any component relying on arbitrary pixel values reaching
`OakJauntyAngleLabel`'s `$top` should be re-checked.

## Checking this repository for regressions

The failure mode is silent, so grep rather than trust the type checker:

```bash
# bare pseudo-selectors that stylis 4 will treat as descendants
grep -rnE '^[[:space:]]*::?[a-z]' src --include='*.tsx' --include='*.ts'

# non-transient custom props on styled components
grep -rnE 'styled\([^)]*\)<\{[^$]' src --include='*.tsx'
```
