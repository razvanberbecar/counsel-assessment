import { describe, expect, it } from 'vitest';
import { decodeData, totals } from './model';
import type { Data, Entry } from './model';
import {
  saveEntry,
  selectReview,
  undoEntries,
  undoRecord,
  updateEntries,
} from './review';
import pilot from './fixtures/pilot-workspace.json';

const load = (): Data => decodeData(JSON.stringify(pilot));
const find = (data: Data, id: string) => data.entries.find((e) => e.id === id)!;
const week = '2026-09-28';

describe('review corrections', () => {
  it('a bulk client move on a reviewed entry requires review again', () => {
    const data = load();
    expect(find(data, 'entry-001').reviewed).toBe(true);
    const next = updateEntries(data, ['entry-001'], { clientId: 'oak' });
    expect(find(next, 'entry-001')).toMatchObject({
      clientId: 'oak',
      reviewed: false,
      billable: true,
      description: 'Shareholder agreement review',
    });
  });
  it('a bulk billability change requires review again', () => {
    const next = updateEntries(load(), ['entry-003'], { billable: false });
    expect(find(next, 'entry-003').reviewed).toBe(false);
  });
  it('a bulk action that changes nothing keeps the review', () => {
    // entry-003 is already billable and with Northstar
    const data = load();
    const next = updateEntries(data, ['entry-003'], {
      billable: true,
      clientId: 'northstar',
    });
    expect(find(next, 'entry-003').reviewed).toBe(true);
  });
  it('explicit review actions still set the review state', () => {
    const next = updateEntries(load(), ['entry-002'], { reviewed: true });
    expect(find(next, 'entry-002').reviewed).toBe(true);
  });
  it('saving an edited description keeps billability and resets review', () => {
    const data = load();
    const original = find(data, 'entry-007'); // non-billable, reviewed
    const next = saveEntry(
      data,
      { ...original, description: 'Knowledge sharing session' },
      undefined,
      original,
    );
    expect(find(next, 'entry-007')).toMatchObject({
      billable: false,
      reviewed: false,
    });
  });
  it('saving an unchanged entry keeps the review', () => {
    const data = load();
    const original = find(data, 'entry-001');
    const next = saveEntry(data, { ...original }, undefined, original);
    expect(find(next, 'entry-001').reviewed).toBe(true);
  });
});

describe('scoped undo', () => {
  it('reverts only the entries the action touched', () => {
    const data = load();
    const after = updateEntries(data, ['entry-001'], { clientId: 'oak' });
    const op = undoRecord('Move to Oak & Stone', data, after, ['entry-001']);
    // Independent work on another entry after the action
    const other = find(after, 'entry-004');
    const withOther = saveEntry(
      after,
      { ...other, description: 'Lease amendment notes v2' },
      undefined,
      other,
    );
    const undone = undoEntries(withOther, op);
    expect(find(undone, 'entry-001')).toEqual(find(data, 'entry-001'));
    expect(find(undone, 'entry-004').description).toBe(
      'Lease amendment notes v2',
    );
  });
  it('declines when an affected entry changed since the action', () => {
    const data = load();
    const after = updateEntries(data, ['entry-001', 'entry-005'], {
      reviewed: false,
    });
    const op = undoRecord('Return to review', data, after, [
      'entry-001',
      'entry-005',
    ]);
    const edited = find(after, 'entry-005');
    const newer = saveEntry(
      after,
      { ...edited, minutes: 180 },
      undefined,
      edited,
    );
    expect(() => undoEntries(newer, op)).toThrow('Undo cancelled');
    // and the newer work is untouched because nothing was saved
    expect(find(newer, 'entry-005').minutes).toBe(180);
  });
  it('declines when an affected entry was deleted', () => {
    const data = load();
    const after = updateEntries(data, ['entry-002'], { reviewed: true });
    const op = undoRecord('Mark reviewed', data, after, ['entry-002']);
    const deleted = {
      ...after,
      entries: after.entries.filter((e) => e.id !== 'entry-002'),
    };
    expect(() => undoEntries(deleted, op)).toThrow('Undo cancelled');
  });
  it('still undoes after a storage roundtrip reorders fields', () => {
    const data = load();
    const after = updateEntries(data, ['entry-002'], { reviewed: true });
    const op = undoRecord('Mark reviewed', data, after, ['entry-002']);
    const reloaded = decodeData(JSON.stringify(after));
    expect(find(undoEntries(reloaded, op), 'entry-002').reviewed).toBe(false);
  });
});

describe('review view', () => {
  it('Meridian filter totals equal the sum of its rows', () => {
    const data = load();
    const rows = selectReview(data.entries, data.clients, {
      week,
      clientId: 'meridian',
      employee: 'all',
      status: 'all',
      search: '',
    });
    expect(rows.map((e) => e.id)).toEqual([
      'entry-001',
      'entry-005',
      'entry-011',
      'entry-014',
      'entry-017',
    ]);
    expect(totals(rows).total).toBe(90 + 150 + 60 + 60 + 30);
  });
});

describe('real-world limits when logging time', () => {
  const today = '2026-10-13';
  const fresh = (over: Partial<Entry>): Entry => ({
    id: 'new-entry',
    date: today,
    minutes: 60,
    clientId: 'oak',
    billable: true,
    description: 'New work',
    employee: 'Alex Morgan',
    ...over,
  });
  it('rejects a new entry dated in the future and accepts today', () => {
    const data = load();
    expect(() =>
      saveEntry(
        data,
        fresh({ date: '2026-10-14' }),
        undefined,
        undefined,
        today,
      ),
    ).toThrow('future date');
    expect(() =>
      saveEntry(data, fresh({}), undefined, undefined, today),
    ).not.toThrow();
  });
  it('rejects moving an existing entry into the future', () => {
    const data = load();
    const original = find(data, 'entry-001');
    expect(() =>
      saveEntry(
        data,
        { ...original, date: '2026-12-01' },
        undefined,
        original,
        today,
      ),
    ).toThrow('future date');
  });
  it('still lets an already future-dated entry be corrected without changing its date', () => {
    const base = load();
    const future = fresh({ id: 'planned', date: '2026-11-02' });
    const data = { ...base, entries: [...base.entries, future] };
    const next = saveEntry(
      data,
      { ...future, description: 'Corrected' },
      undefined,
      future,
      today,
    );
    expect(find(next, 'planned').description).toBe('Corrected');
  });
  it('blocks a day over 24 hours for one person but allows exactly 24', () => {
    const data = load();
    const big = saveEntry(
      data,
      fresh({ id: 'a', minutes: 1200 }),
      undefined,
      undefined,
      today,
    );
    expect(() =>
      saveEntry(
        big,
        fresh({ id: 'b', minutes: 300 }),
        undefined,
        undefined,
        today,
      ),
    ).toThrow('more than 24 hours');
    expect(() =>
      saveEntry(
        big,
        fresh({ id: 'b', minutes: 240 }),
        undefined,
        undefined,
        today,
      ),
    ).not.toThrow();
    // A different person on the same day is counted separately
    expect(() =>
      saveEntry(
        big,
        fresh({ id: 'c', minutes: 300, employee: 'Sofia Keller' }),
        undefined,
        undefined,
        today,
      ),
    ).not.toThrow();
  });
  it('backups are not subject to the logging limits', () => {
    const data = load();
    const backup = {
      ...data,
      entries: [...data.entries, fresh({ id: 'f', date: '2099-01-01' })],
    };
    expect(decodeData(JSON.stringify(backup)).entries).toHaveLength(
      data.entries.length + 1,
    );
  });
});
