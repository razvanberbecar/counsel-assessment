import { useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Pencil,
  Search,
  Undo2,
} from 'lucide-react';
import type { Data, Entry } from '../model';
import {
  addDays,
  csv,
  download,
  duration,
  localDate,
  shortDate,
  totals,
  weekStart,
} from '../model';
import {
  selectReview,
  undoEntries,
  undoRecord,
  updateEntries,
} from '../review';
import type { EntryPatch, UndoRecord } from '../review';

export function ReviewPage({
  data,
  save,
  onEdit,
  readOnly,
}: {
  data: Data;
  save: (data: Data) => void;
  onEdit: (entry: Entry) => void;
  readOnly: boolean;
}) {
  const [week, setWeek] = useState(() =>
    weekStart(
      data.entries
        .map((e) => e.date)
        .sort()
        .at(-1) ?? localDate(),
    ),
  );
  const [clientId, setClientId] = useState('all');
  const [employee, setEmployee] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState('review');
  const [targetClient, setTargetClient] = useState(data.clients[0]?.id ?? '');
  const [operation, setOperation] = useState<UndoRecord | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const filters = { week, clientId, employee, status, search };
  const visible = selectReview(data.entries, data.clients, filters);
  // Totals and export always describe exactly the rows in view.
  const summary = totals(visible);
  const pending = visible.filter((e) => !e.reviewed).length;
  const exportEntries = visible;
  // Actions can only reach selected rows that are currently in view.
  const visibleIds = new Set(visible.map((e) => e.id));
  const selectedIds = selected.filter((id) => visibleIds.has(id));
  const selectedEntries = visible.filter((e) => selectedIds.includes(e.id));
  const selectedClients = [
    ...new Set(
      selectedEntries.map(
        (e) => data.clients.find((c) => c.id === e.clientId)?.name ?? '',
      ),
    ),
  ];
  const targetClientName =
    data.clients.find((c) => c.id === targetClient)?.name ?? '';
  const actionLabels: Record<string, string> = {
    review: 'Mark reviewed',
    reopen: 'Return to review',
    billable: 'Mark billable',
    nonbillable: 'Mark non-billable',
    client: `Move to ${targetClientName}`,
  };
  const employees = [...new Set(data.entries.map((e) => e.employee))].sort();
  const plural = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;
  // Changing week, filters or search clears the selection and says so, so an
  // action never reaches rows the reviewer can no longer see.
  function changeView(update: () => void) {
    update();
    if (selectedIds.length) {
      setSelected([]);
      setMessage(
        `Selection cleared because the view changed (${plural(selectedIds.length)} were selected).`,
      );
    }
  }
  function apply(
    ids: string[],
    patch: EntryPatch,
    label: string,
    keepSelection = false,
  ) {
    setError('');
    try {
      const next = updateEntries(data, ids, patch);
      save(next);
      setOperation(
        undoRecord(`${label} (${plural(ids.length)})`, data, next, ids),
      );
      if (!keepSelection) setSelected([]);
      const stillVisible = new Set(
        selectReview(next.entries, next.clients, filters).map((e) => e.id),
      );
      const left = ids.filter((id) => !stillVisible.has(id)).length;
      setMessage(
        `${label}: ${plural(ids.length)} updated.${left ? ` ${left} no longer ${left === 1 ? 'matches' : 'match'} the filters and left this view.` : ''}`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="review-page" aria-label="Weekly review">
      <div className="period-toolbar">
        <div className="week-selector">
          <button
            className="icon-button"
            aria-label="Previous review week"
            onClick={() => changeView(() => setWeek(addDays(week, -7)))}
          >
            <ChevronLeft size={18} />
          </button>
          <label className="review-date">
            Week of
            <input
              aria-label="Review week"
              type="date"
              value={week}
              onChange={(e) =>
                e.target.value &&
                changeView(() => setWeek(weekStart(e.target.value)))
              }
            />
          </label>
          <button
            className="icon-button"
            aria-label="Next review week"
            onClick={() => changeView(() => setWeek(addDays(week, 7)))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          className="button secondary small"
          disabled={!visible.length}
          onClick={() => {
            download(
              csv(exportEntries, data.clients),
              `counsel-review-${week}.csv`,
              'text/csv;charset=utf-8',
            );
            setMessage(`Exported ${exportEntries.length} entries.`);
          }}
        >
          <ArrowDownToLine size={16} />
          Export view
        </button>
      </div>
      <div className="review-progress">
        <span className="review-emblem">
          <ClipboardCheck size={24} />
        </span>
        <div>
          <h2>Weekly review</h2>
          <p>Check time entries and prepare this week's records.</p>
        </div>
      </div>
      <div className="review-summary" aria-label="Review summary">
        <div>
          <span>Entries in view</span>
          <strong>{visible.length}</strong>
        </div>
        <div>
          <span>Time in view</span>
          <strong data-testid="review-total">{duration(summary.total)}</strong>
        </div>
        <div>
          <span>Billable in view</span>
          <strong>{duration(summary.billable)}</strong>
        </div>
        <div>
          <span>Reviewed in view</span>
          <strong>
            {visible.length - pending} / {visible.length}
          </strong>
          {pending > 0 && status !== 'pending' && (
            <button
              className="text-button"
              onClick={() => changeView(() => setStatus('pending'))}
            >
              Show {pending} needing review
            </button>
          )}
        </div>
      </div>
      <div className="entries-panel">
        <div className="panel-title">
          <div>
            <h2>Check the details.</h2>
            <p>Select entries and update the week’s records.</p>
          </div>
        </div>
        <div className="filters review-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search review"
              placeholder="Find an entry…"
              value={search}
              onChange={(e) => changeView(() => setSearch(e.target.value))}
            />
          </label>
          <select
            aria-label="Review client"
            value={clientId}
            onChange={(e) => changeView(() => setClientId(e.target.value))}
          >
            <option value="all">All clients</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Review employee"
            value={employee}
            onChange={(e) => changeView(() => setEmployee(e.target.value))}
          >
            <option value="all">All team members</option>
            {employees.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <select
            aria-label="Review status"
            value={status}
            onChange={(e) => changeView(() => setStatus(e.target.value))}
          >
            <option value="all">All review states</option>
            <option value="pending">Needs review</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
        <div className="bulk-toolbar">
          <label className="select-visible">
            <input
              type="checkbox"
              aria-label="Select visible entries"
              ref={(el) => {
                if (el)
                  el.indeterminate =
                    selectedIds.length > 0 &&
                    selectedIds.length < visible.length;
              }}
              checked={
                visible.length > 0 && selectedIds.length === visible.length
              }
              disabled={!visible.length || readOnly}
              onChange={(e) =>
                setSelected(e.target.checked ? visible.map((e) => e.id) : [])
              }
            />
            Select visible
          </label>
          <span className="selection-count">
            {selectedIds.length} selected
            {selectedIds.length > 0 && (
              <button
                className="text-button"
                onClick={() => {
                  setSelected([]);
                  setMessage('Selection cleared.');
                }}
              >
                Clear
              </button>
            )}
          </span>
          <select
            aria-label="Bulk action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="review">Mark reviewed</option>
            <option value="reopen">Return to review</option>
            <option value="billable">Mark billable</option>
            <option value="nonbillable">Mark non-billable</option>
            <option value="client">Move to client</option>
          </select>
          {action === 'client' && (
            <select
              aria-label="Destination client"
              value={targetClient}
              onChange={(e) => setTargetClient(e.target.value)}
            >
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="button primary small"
            disabled={!selectedIds.length || readOnly}
            onClick={() =>
              apply(
                selectedIds,
                action === 'client'
                  ? { clientId: targetClient }
                  : action === 'review' || action === 'reopen'
                    ? { reviewed: action === 'review' }
                    : { billable: action === 'billable' },
                actionLabels[action],
              )
            }
          >
            Apply to {selectedIds.length} selected
          </button>
        </div>
        <p className="action-scope" data-testid="action-scope">
          {selectedIds.length
            ? `“${actionLabels[action]}” will change ${plural(selectedIds.length)} (${duration(totals(selectedEntries).total)}) from ${selectedClients.join(', ')}. Only selected rows in this view are affected.`
            : 'Select rows below to act on them. Changing the week, filters or search clears the selection.'}
        </p>
        {error && (
          <p className="form-error review-feedback" role="alert">
            {error}
          </p>
        )}
        <div className="review-notice" aria-live="polite">
          {message && <span>{message}</span>}
          {operation && (
            <button
              className="text-button"
              disabled={readOnly}
              onClick={() => {
                try {
                  save(undoEntries(data, operation));
                  setOperation(null);
                  setError('');
                  setMessage(`Undone: ${operation.label}.`);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Undo2 size={14} />
              Undo: {operation.label}
            </button>
          )}
        </div>
        {!visible.length ? (
          <div className="empty-state">
            <ClipboardCheck size={28} />
            <h3>Nothing in this view.</h3>
            <p>Choose another week or adjust your filters.</p>
          </div>
        ) : (
          <div className="review-rows">
            {visible.map((entry) => {
              const client = data.clients.find((c) => c.id === entry.clientId)!;
              return (
                <article
                  className={`review-row ${selectedIds.includes(entry.id) ? 'is-selected' : ''}`}
                  data-entry-id={entry.id}
                  key={entry.id}
                >
                  <label className="review-checkbox">
                    <input
                      type="checkbox"
                      aria-label={`Select ${entry.description || client.name}`}
                      checked={selectedIds.includes(entry.id)}
                      disabled={readOnly}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selectedIds, entry.id]
                            : selectedIds.filter((id) => id !== entry.id),
                        )
                      }
                    />
                  </label>
                  <div className="review-entry">
                    <div className="review-entry-meta">
                      <span style={{ background: client.color }} />
                      <strong>{client.name}</strong>
                      <span>{shortDate(entry.date)}</span>
                    </div>
                    <p>{entry.description || 'No description'}</p>
                    <span className="review-employee">{entry.employee}</span>
                  </div>
                  <div className="review-duration">
                    <strong>{duration(entry.minutes)}</strong>
                    <span
                      className={`status-tag ${entry.billable ? 'billable' : ''}`}
                    >
                      {entry.billable ? 'Billable' : 'Non-billable'}
                    </span>
                  </div>
                  <button
                    className={`review-state ${entry.reviewed ? 'is-reviewed' : ''}`}
                    disabled={readOnly}
                    aria-label={`${entry.reviewed ? 'Reopen' : 'Review'} ${entry.description || client.name}`}
                    onClick={() =>
                      apply(
                        [entry.id],
                        { reviewed: !entry.reviewed },
                        entry.reviewed ? 'Return to review' : 'Mark reviewed',
                        true,
                      )
                    }
                  >
                    {entry.reviewed && <Check size={13} />}{' '}
                    {entry.reviewed ? 'Reviewed' : 'Needs review'}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Edit review entry: ${entry.description || client.name}`}
                    disabled={readOnly}
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
        <div className="table-footer">
          <span>
            {visible.length} entries · {shortDate(week)} –{' '}
            {shortDate(addDays(week, 6))}
          </span>
          <span>
            Export includes the {plural(visible.length)} in this view; selection
            does not change it.
          </span>
        </div>
      </div>
    </section>
  );
}
