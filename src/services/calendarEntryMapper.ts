import type { TableRow } from '../types/database';
import type { CalendarEntry } from '../types/domain/calendarEntry';

type CalendarEntryRow = TableRow<'calendar_entry'>;

export function toCalendarEntry(row: CalendarEntryRow): CalendarEntry {
  return {
    id: row.id,
    planId: row.plan_id,
    brandId: row.brand_id,
    date: row.date,
    type: row.type,
    platform: row.platform,
    title: row.title,
    script: row.script,
    notes: row.notes,
    status: row.status,
    templateId: row.template_id,
    createdAt: row.created_at,
  };
}
