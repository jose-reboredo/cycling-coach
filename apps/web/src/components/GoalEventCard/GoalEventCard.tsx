import { useEffect, useState } from 'react';
import { Card } from '../Card/Card';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { Button } from '../Button/Button';
import { daysBetween } from '../../lib/format';
import {
  EVENT_TYPE_LABELS,
  type EventType,
  type GoalEvent,
} from '../../hooks/useGoalEvent';
import styles from './GoalEventCard.module.css';

interface GoalEventCardProps {
  event: GoalEvent | null;
  onSave: (next: GoalEvent) => void;
  onClear: () => void;
}

const EVENT_TYPE_OPTIONS: EventType[] = [
  'gran_fondo',
  'race',
  'tt',
  'crit',
  'volume',
  'tour',
  'other',
];

const PRIORITY_LABEL: Record<1 | 2 | 3, string> = {
  1: 'A — race day',
  2: 'B — tune-up',
  3: 'C — training',
};

export function GoalEventCard({ event, onSave, onClear }: GoalEventCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GoalEvent>(
    () =>
      event ?? {
        name: '',
        type: 'gran_fondo',
        date: '',
        distanceKm: 0,
        elevationM: 0,
        location: '',
        priority: 1,
      },
  );

  useEffect(() => {
    if (event) setDraft(event);
  }, [event]);

  const daysOut = event ? daysBetween(new Date(), event.date) : null;

  if (editing || !event) {
    return (
      <Card tone="elev" pad="md" className={styles.root}>
        <div className={styles.head}>
          <Eyebrow tone="accent">{event ? 'Edit goal event' : 'Set your goal event'}</Eyebrow>
          {event ? (
            <button
              type="button"
              className={styles.subtleBtn}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          ) : null}
        </div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.name.trim() || !draft.date) return;
            onSave({
              ...draft,
              distanceKm: Number(draft.distanceKm) || 0,
              elevationM: Number(draft.elevationM) || 0,
            });
            setEditing(false);
          }}
        >
          <Field label="Event name">
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Etape du Tour 2026"
              className={styles.input}
            />
          </Field>

          <div className={styles.row2}>
            <Field label="Type">
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as EventType })}
                className={styles.input}
              >
                {EVENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                required
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className={styles.input}
              />
            </Field>
          </div>

          <div className={styles.row2}>
            <Field label="Distance · km">
              <input
                type="number"
                min={0}
                value={draft.distanceKm || ''}
                onChange={(e) =>
                  setDraft({ ...draft, distanceKm: Number(e.target.value) || 0 })
                }
                placeholder="168"
                className={styles.input}
              />
            </Field>
            <Field label="Elevation · m">
              <input
                type="number"
                min={0}
                value={draft.elevationM || ''}
                onChange={(e) =>
                  setDraft({ ...draft, elevationM: Number(e.target.value) || 0 })
                }
                placeholder="4200"
                className={styles.input}
              />
            </Field>
          </div>

          <Field label="Location">
            <input
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              placeholder="Albertville → La Plagne"
              className={styles.input}
            />
          </Field>

          <Field label="Priority">
            <div className={styles.priorityRow}>
              {([1, 2, 3] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.priorityBtn} ${draft.priority === p ? styles.priorityActive : ''}`}
                  onClick={() => setDraft({ ...draft, priority: p })}
                  aria-pressed={draft.priority === p}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </Field>

          <div className={styles.actions}>
            <Button type="submit" variant="primary" size="md">
              Save
            </Button>
            {event ? (
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => {
                  onClear();
                  setEditing(false);
                }}
              >
                Clear event
              </button>
            ) : null}
          </div>
        </form>
      </Card>
    );
  }

  // Display mode
  return (
    <Card tone="elev" pad="md" className={styles.root}>
      <div className={styles.head}>
        <Eyebrow tone="accent">Goal event</Eyebrow>
        <div className={styles.headRight}>
          <Pill tone="accent">
            {daysOut !== null && daysOut > 0
              ? `${daysOut}d`
              : daysOut === 0
                ? 'today'
                : `${Math.abs(daysOut ?? 0)}d ago`}
          </Pill>
          <button
            type="button"
            className={styles.subtleBtn}
            onClick={() => setEditing(true)}
            aria-label="Edit event"
          >
            Edit
          </button>
        </div>
      </div>
      <h3 className={styles.title}>{event.name}</h3>
      <p className={styles.sub}>
        {EVENT_TYPE_LABELS[event.type]} · {event.location || 'no location'}
      </p>
      <div className={styles.stats}>
        <div>
          <span>{event.distanceKm}</span>
          <span>km</span>
        </div>
        <div>
          <span>{event.elevationM.toLocaleString()}</span>
          <span>m vert</span>
        </div>
        <div>
          <span>
            {new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
          <span>{PRIORITY_LABEL[event.priority].split(' ')[0]} race</span>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
