# Release handover

## Changed

I fixed the three reports first, since each leaves wrong billing data, then made one Friday-review improvement.

- **Billable flipped on edit (Alex):** the edit form always started as billable. It now uses the entry's value ([EntryForm.tsx](src/components/EntryForm.tsx)).
- **Totals and export (Sofia):** both used the whole week. Now they use exactly the filtered rows, and selection never changes the export.
- **Corrections after review (Sofia):** bulk client or billability changes now clear _Reviewed_. Undo restored a snapshot of the whole workspace. It now reverts only the affected entries, and declines with a reason if any changed since ([review.ts](src/review.ts)).
- **Improvement:** before, selecting 18 rows then filtering to Meridian left "Apply to 18 selected" changing 13 hidden rows. Now actions reach only selected rows in view, and a view change clears the selection with a notice. A scope line names the action, count, hours and clients, and Undo names what it reverts. I also added a "Show N needing review" shortcut.
- **Found in testing:** typing into "Week of" rewrote the field on every keystroke, so 01/10/2026 became 1 June. It now snaps to the Monday when you leave the field. New or moved time can't be future-dated or push one person past 24 hours a day. Backups are exempt.
- **Visual refresh:** a CSS-only redesign with design tokens and a higher-contrast palette ([styles.css](src/styles.css)). No markup or behaviour changed.

## Verified

- `npm run check`: 49 unit/component tests and the build pass.
- `npm run test:e2e`: 24 pass and 2 are skipped (keyboard typing on mobile), across desktop and mobile Chromium. They cover each report, keyboard date entry, axe with rows selected, and a [click-through of every control](tests/tour.spec.ts) that fails on any console error. GitHub Actions passes.
- The new report and date tests fail on the untouched starter.

## Remaining

Deferred: dark theme, repeat yesterday's entry, and review status in the CSV. Risks:

- Undo is single-level and is lost on reload.
- View changes clear the selection.
- The future-date check uses the device clock.
- Client renames keep entries reviewed.
- No Safari or screen-reader testing.

## Release recommendation

Yes, release to the pilot with these limitations.

## AI use

Claude Code (Opus 5.5) drafted most of the code and tests. A background agent did the redesign in an isolated worktree. I merged it only after checking its diff (one CSS file, no external resources) and re-running every test. Two corrections:

- The first selected-row highlight failed WCAG contrast, so it became an edge bar.
- The keyboard date tests passed on Windows but failed in Linux CI, which lays the field out as mm/dd. They now use order-independent dates.
