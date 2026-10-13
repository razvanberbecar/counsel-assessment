# Release handover

## Changed

I fixed the three reports first, since each leaves wrong billing data, then made one Friday-review improvement.

- **Billable flipped on edit (Alex):** the edit form always started as billable. It now uses the entry's value ([EntryForm.tsx](src/components/EntryForm.tsx)).
- **Totals and export (Sofia):** both used the whole week. Now they use exactly the filtered rows, and selection never changes the export.
- **Corrections after review (Sofia):** bulk client or billability changes now clear _Reviewed_. Undo restored a snapshot of the whole workspace. It now reverts only the affected entries, and declines with a reason if any changed since ([review.ts](src/review.ts)).
- **Improvement:** selecting 18 rows and then filtering to Meridian made "Apply to 18 selected" change 13 hidden rows. Now actions reach only selected rows in view, and a view change clears the selection with a notice. A scope line names the action, count, hours and clients, and Undo names what it reverts. I also added a "Show N needing review" shortcut.
- **Also:**
  - Keyboard entry in "Week of" works (01/10 used to become 1 June).
  - Time can't be future-dated or exceed 24 hours a day per person; backups are exempt.
  - Redesign: a light top navigation, plain labels instead of slogans, and a dark theme (moon icon). Two starter tests changed wording only.

## Verified

- `npm run check`: 49 unit/component tests and the build pass.
- `npm run test:e2e`: 26 pass and 2 are skipped (keyboard typing on mobile). They cover each report, date entry, axe in light and dark themes, and a [click-through of every control](tests/tour.spec.ts). GitHub Actions passes.
- The new report and date tests fail on the untouched starter.

## Remaining

Deferred: repeat yesterday's entry, and review status in the CSV. Risks: single-level undo is lost on reload; view changes clear the selection; the future-date check trusts the device clock; client renames keep entries reviewed; no Safari or screen-reader testing.

## Release recommendation

Yes, release to the pilot with these limitations.

## AI use

Claude Code (Opus 5.5) drafted most of the code and tests. A background agent did the first token-based restyle in an isolated worktree. I reviewed the diffs and re-ran every check before merging. Corrections:

- The first selected-row highlight failed WCAG contrast, so it became an edge bar.
- Date tests that passed on Windows failed in Linux CI, which lays the field out as mm/dd. They now use order-independent dates.
