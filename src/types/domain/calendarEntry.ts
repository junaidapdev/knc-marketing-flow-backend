export type CalendarEntryType =
  | 'snap_story'
  | 'snap_spotlight'
  | 'tiktok_video'
  | 'ig_video'
  | 'ig_story'
  | 'shop_activity'
  | 'offer'
  | 'shoot'
  | 'engagement'
  | 'research';

export type CalendarEntryStatus = 'planned' | 'in_progress' | 'ready' | 'posted';

export interface CalendarEntry {
  id: string;
  planId: string;
  brandId: string;
  date: string;
  type: CalendarEntryType;
  platform: string | null;
  title: string;
  script: string | null;
  notes: string | null;
  status: CalendarEntryStatus;
  templateId: string | null;
  createdAt: string;
}
