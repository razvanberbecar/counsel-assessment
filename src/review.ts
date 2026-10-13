import type { Client, Data, Entry } from './model';
import {
  addDays,
  duration,
  localDate,
  shortDate,
  validateEntry,
} from './model';

export type ReviewFilters = {
  week: string;
  clientId: string;
  employee: string;
  status: string;
  search: string;
};
export type EntryPatch = Partial<
  Pick<Entry, 'clientId' | 'billable' | 'reviewed'>
>;
export type EntryChange = { before: Entry; after: Entry };
export type UndoRecord = { label: string; changes: EntryChange[] };

export function selectWeek(entries: Entry[], week: string) {
  return entries.filter(
    (entry) => entry.date >= week && entry.date <= addDays(week, 6),
  );
}
export function selectReview(
  entries: Entry[],
  clients: Client[],
  filters: ReviewFilters,
) {
  return selectWeek(entries, filters.week)
    .filter(
      (entry) =>
        (filters.clientId === 'all' || entry.clientId === filters.clientId) &&
        (filters.employee === 'all' || entry.employee === filters.employee) &&
        (filters.status === 'all' ||
          !!entry.reviewed === (filters.status === 'reviewed')) &&
        `${entry.description} ${clients.find((c) => c.id === entry.clientId)?.name ?? ''} ${entry.employee}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.employee.localeCompare(b.employee) ||
        a.id.localeCompare(b.id),
    );
}
// True when any field covered by review differs. `reviewed` itself is not a reviewed field.
export function reviewedFieldsChanged(previous: Entry, next: Entry) {
  return (
    previous.date !== next.date ||
    previous.minutes !== next.minutes ||
    previous.clientId !== next.clientId ||
    previous.billable !== next.billable ||
    previous.description !== next.description ||
    previous.employee !== next.employee
  );
}
// Field-wise equality; a missing `reviewed` (older backups) equals false.
export function sameEntry(a: Entry, b: Entry) {
  return (
    a.id === b.id &&
    !reviewedFieldsChanged(a, b) &&
    !!a.reviewed === !!b.reviewed
  );
}
export function applyEntryUpdate(previous: Entry, next: Entry): Entry {
  return {
    ...next,
    reviewed: reviewedFieldsChanged(previous, next) ? false : previous.reviewed,
  };
}
export function saveEntry(
  data: Data,
  entry: Entry,
  client?: Client,
  original?: Entry,
  today = localDate(),
): Data {
  const previous = data.entries.find((e) => e.id === entry.id);
  if (
    original &&
    (!previous || JSON.stringify(previous) !== JSON.stringify(original))
  )
    throw new Error(
      'This entry changed while you were editing. Close and reopen it to use the latest version.',
    );
  const clients = client ? [...data.clients, client] : data.clients;
  validateEntry(entry, clients);
  // Real-world limits for logged time. They apply when time is logged or
  // corrected, not to backups, so existing records always remain loadable.
  if (entry.date > today && entry.date !== previous?.date)
    throw new Error(
      'Time can’t be logged for a future date. Choose today or an earlier date.',
    );
  const sameDay = data.entries
    .filter(
      (e) =>
        e.id !== entry.id &&
        e.employee === entry.employee &&
        e.date === entry.date,
    )
    .reduce((n, e) => n + e.minutes, 0);
  const unchangedDay =
    previous?.date === entry.date && previous.employee === entry.employee;
  // Only block saves that add time to a day that would exceed 24 hours.
  if (
    sameDay + entry.minutes > 1440 &&
    entry.minutes > (unchangedDay ? previous.minutes : 0)
  )
    throw new Error(
      `This would bring ${entry.employee}’s time on ${shortDate(entry.date)} to ${duration(sameDay + entry.minutes)}. One person can’t log more than 24 hours in a day.`,
    );
  return {
    ...data,
    clients,
    entries: [
      ...data.entries.filter((e) => e.id !== entry.id),
      previous
        ? applyEntryUpdate(previous, entry)
        : { ...entry, reviewed: false },
    ],
  };
}
export function updateEntries(
  data: Data,
  ids: string[],
  patch: EntryPatch,
): Data {
  const selected = new Set(ids);
  if (ids.some((id) => !data.entries.some((e) => e.id === id)))
    throw new Error('An entry no longer exists. Refresh your selection.');
  return {
    ...data,
    entries: data.entries.map((entry) => {
      if (!selected.has(entry.id)) return entry;
      const merged = { ...entry, ...patch };
      validateEntry(merged, data.clients);
      // A correction (client or billability) invalidates an earlier review,
      // unless this action is itself setting the review state.
      return patch.reviewed === undefined
        ? applyEntryUpdate(entry, merged)
        : merged;
    }),
  };
}
export function undoRecord(
  label: string,
  before: Data,
  after: Data,
  ids: string[],
): UndoRecord {
  return {
    label,
    changes: ids.map((id) => ({
      before: before.entries.find((e) => e.id === id)!,
      after: after.entries.find((e) => e.id === id)!,
    })),
  };
}
// Reverts only the entries the action touched. If any of them was changed or
// deleted afterwards, the undo is declined so newer work is never overwritten.
export function undoEntries(data: Data, operation: UndoRecord): Data {
  const current = new Map(data.entries.map((e) => [e.id, e]));
  const conflicts = operation.changes.filter(({ after }) => {
    const now = current.get(after.id);
    return !now || !sameEntry(now, after);
  });
  if (conflicts.length)
    throw new Error(
      `Undo cancelled: ${conflicts.length} of the ${operation.changes.length} affected ${operation.changes.length === 1 ? 'entry has' : 'entries have'} been changed or deleted since. Nothing was reverted, so newer work is kept.`,
    );
  const restore = new Map(
    operation.changes.map((c) => [c.before.id, c.before]),
  );
  return {
    ...data,
    entries: data.entries.map((entry) => {
      const before = restore.get(entry.id);
      if (!before) return entry;
      validateEntry(before, data.clients);
      return before;
    }),
  };
}
