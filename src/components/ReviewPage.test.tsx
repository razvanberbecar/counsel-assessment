import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { decodeData } from '../model';
import type { Data, Entry } from '../model';
import pilot from '../fixtures/pilot-workspace.json';
import { ReviewPage } from './ReviewPage';
import { EntryForm } from './EntryForm';

const download = vi.hoisted(() => vi.fn());
vi.mock('../model', async (original) => ({
  ...(await original<typeof import('../model')>()),
  download,
}));

beforeEach(() => {
  download.mockReset();
  // jsdom does not implement <dialog> modality; the Modal component needs it.
  HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
  };
});
afterEach(cleanup);

function Harness({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial);
  return (
    <>
      <ReviewPage
        data={data}
        save={setData}
        onEdit={() => {}}
        readOnly={false}
      />
      <output data-testid="state">{JSON.stringify(data.entries)}</output>
    </>
  );
}
const setup = () => {
  const user = userEvent.setup();
  render(<Harness initial={decodeData(JSON.stringify(pilot))} />);
  return user;
};
const rows = () => document.querySelectorAll('.review-row');
const state = (): Entry[] =>
  JSON.parse(screen.getByTestId('state').textContent!);
const byId = (id: string) => state().find((e) => e.id === id)!;

describe('EntryForm', () => {
  it('keeps a non-billable entry non-billable when only the description changes', async () => {
    const user = userEvent.setup();
    const data = decodeData(JSON.stringify(pilot));
    const entry = data.entries.find((e) => e.id === 'entry-002')!;
    const onSave = vi.fn();
    render(
      <EntryForm
        entry={entry}
        clients={data.clients}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    const description = screen.getByLabelText(/Description/);
    await user.clear(description);
    await user.type(description, 'Weekly team planning and staffing');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      billable: false,
      description: 'Weekly team planning and staffing',
    });
  });
});

describe('Weekly review', () => {
  it('opens on the pilot week with all 18 entries', () => {
    setup();
    expect(screen.getByLabelText('Review week')).toHaveValue('2026-09-28');
    expect(rows()).toHaveLength(18);
  });

  it('totals and export match the filtered rows', async () => {
    const user = setup();
    await user.selectOptions(
      screen.getByLabelText('Review client'),
      'meridian',
    );
    expect(rows()).toHaveLength(5);
    // 90 + 150 + 60 + 60 + 30 minutes
    expect(screen.getByTestId('review-total')).toHaveTextContent('6h 30m');
    await user.selectOptions(
      screen.getByLabelText('Review status'),
      'reviewed',
    );
    expect(rows()).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /Export view/ }));
    const file: string = download.mock.calls[0][0];
    const lines = file.trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 visible rows
    expect(file).toContain('Shareholder agreement review');
    expect(file).toContain('Transaction due diligence');
    expect(file).not.toContain('Closing checklist');
  });

  it('export ignores selection', async () => {
    const user = setup();
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Weekly team planning' }),
    );
    await user.click(screen.getByRole('button', { name: /Export view/ }));
    expect(download.mock.calls[0][0].trim().split('\r\n')).toHaveLength(19);
  });

  it('clears and announces the selection when the view changes', async () => {
    const user = setup();
    await user.click(screen.getByLabelText('Select visible entries'));
    expect(document.querySelector('.selection-count')).toHaveTextContent(
      '18 selected',
    );
    await user.selectOptions(screen.getByLabelText('Review client'), 'oak');
    expect(document.querySelector('.selection-count')).toHaveTextContent(
      '0 selected',
    );
    expect(
      screen.getByText(/Selection cleared because the view changed/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Apply to 0 selected/ }),
    ).toBeDisabled();
  });

  it('explains the scope of the next action', async () => {
    const user = setup();
    await user.selectOptions(
      screen.getByLabelText('Review client'),
      'meridian',
    );
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select Shareholder agreement review',
      }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Closing checklist' }),
    );
    expect(screen.getByTestId('action-scope')).toHaveTextContent(
      '“Mark reviewed” will change 2 entries (2h 30m) from Meridian Holdings.',
    );
  });

  it('moving a reviewed entry with review actions requires review again, and undo is scoped', async () => {
    const user = setup();
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select Shareholder agreement review',
      }),
    );
    await user.selectOptions(screen.getByLabelText('Bulk action'), 'client');
    await user.selectOptions(
      screen.getByLabelText('Destination client'),
      'oak',
    );
    await user.click(
      screen.getByRole('button', { name: /Apply to 1 selected/ }),
    );
    expect(byId('entry-001')).toMatchObject({
      clientId: 'oak',
      reviewed: false,
    });
    const row = document.querySelector('[data-entry-id="entry-001"]')!;
    expect(within(row as HTMLElement).getByText('Needs review')).toBeVisible();

    // Independent work after the action: review another entry
    await user.click(
      screen.getByRole('button', { name: 'Review Weekly team planning' }),
    );
    expect(byId('entry-002').reviewed).toBe(true);
    // Undo reverts only the last action (entry-002), not the earlier move
    await user.click(
      screen.getByRole('button', { name: /Undo: Mark reviewed/ }),
    );
    expect(byId('entry-002').reviewed).toBe(false);
    expect(byId('entry-001').clientId).toBe('oak');
  });

  it('undoing a billability correction restores billability and review', async () => {
    const user = setup();
    await user.click(
      screen.getByRole('button', { name: 'Review Weekly team planning' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Weekly team planning' }),
    );
    await user.selectOptions(screen.getByLabelText('Bulk action'), 'billable');
    await user.click(
      screen.getByRole('button', { name: /Apply to 1 selected/ }),
    );
    expect(byId('entry-002')).toMatchObject({
      billable: true,
      reviewed: false,
    });
    // The undo now covers the billable change; it applies cleanly
    await user.click(
      screen.getByRole('button', { name: /Undo: Mark billable/ }),
    );
    expect(byId('entry-002')).toMatchObject({
      billable: false,
      reviewed: true,
    });
  });
});
