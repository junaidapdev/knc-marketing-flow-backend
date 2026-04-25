import type { CalendarEntryType } from './calendarEntry';

export type TemplateCadence = 'daily' | 'weekly' | 'monthly' | 'custom';

export type ShootMode = 'shoot_daily' | 'shoot_weekly_post_daily' | 'none';

export interface RecurringTemplate {
  id: string;
  name: string;
  brandId: string;
  contentType: CalendarEntryType;
  cadence: TemplateCadence;
  daysOfWeek: number[] | null;
  defaultAssigneeId: string;
  shootMode: ShootMode;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}
