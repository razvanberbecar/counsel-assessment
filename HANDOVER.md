# Release handover

## Changed

I fixed the three reports first, since each leaves wrong billing data.

- Alex's edit made entries billable: the edit form always started as billable. It now keeps the entry's value.
- Sofia's totals and export used the whole week. They now use the filtered rows; selection never changes the export.
- Corrections after review: bulk client or billability changes now clear Reviewed. Undo reverts only the affected entries, and declines with a reason if they changed since.
- Friday improvement: filtering kept hidden rows selected, so "Apply to 18 selected" could change 13 hidden rows. Actions now reach only selected rows in view. View changes clear the selection with a notice, a scope line names what will change, and Undo names what it reverts.
- Also: typing a date into "Week of" works; time can't be future-dated or exceed 24 hours a day per person (backups exempt). Redesign: top navigation, plain labels and a dark theme.

## Verified

- npm run check: 49 unit tests and the build pass.
- npm run test:e2e: 26 pass and 2 are skipped (typing on mobile). They cover each report, axe in light and dark mode, and a click-through of every control. GitHub Actions passes.
- The new tests fail on the untouched starter.

## Remaining

Deferred: repeat yesterday's entry, and review status in the CSV. Risks: undo is single-level and lost on reload; the future-date check trusts the device clock; no Safari or screen-reader testing.

## Release recommendation

Yes, release to the pilot with these limitations.

## AI use

Claude Code drafted most of the code and tests, and an agent did the first restyle. I reviewed the diffs and re-ran the checks. Corrections:

- A row highlight failed WCAG contrast, so it became an edge bar.
- Date tests failed on Linux CI (mm/dd layout), so they now use order-independent dates.
