export type AssigneeRole = 'content_engagement' | 'digital_marketing_production';

export interface Assignee {
  id: string;
  name: string;
  role: AssigneeRole;
  isActive: boolean;
  createdAt: string;
}
