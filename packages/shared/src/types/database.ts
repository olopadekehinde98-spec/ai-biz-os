export type UserPlan = 'starter' | 'pro' | 'enterprise';

export type ConnectedPlatform =
  | 'google_analytics'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'twitter'
  | 'google_ads'
  | 'meta_ads';

export type MemoryType = 'fact' | 'preference' | 'goal' | 'event' | 'insight';

export type ActionStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

export type TicketSentiment = 'positive' | 'neutral' | 'frustrated' | 'angry';

export type TicketStatus = 'open' | 'ai_replied' | 'escalated' | 'resolved';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: UserPlan;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  industry: string | null;
  description: string | null;
  goals: string[];
  timezone: string;
  created_at: string;
}

export interface ConnectedAccount {
  id: string;
  business_id: string;
  platform: ConnectedPlatform;
  access_token: string;
  refresh_token: string | null;
  account_name: string | null;
  is_active: boolean;
  expires_at: string | null;
}

export interface AiMemory {
  id: string;
  business_id: string;
  memory_type: MemoryType;
  content: string;
  pinecone_id: string | null;
  importance_score: number;
  created_at: string;
}

export interface DailyReport {
  id: string;
  business_id: string;
  report_date: string;
  content: ReportContent;
  summary: string;
  key_insights: string[];
  action_items: string[];
  sent_at: string | null;
}

export interface ReportContent {
  executive_summary: string;
  revenue_financial: string;
  marketing_performance: string;
  customer_support: string;
  growth_opportunities: string;
  priority_actions: string[];
}

export interface AiAction {
  id: string;
  business_id: string;
  action_type: string;
  description: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  created_at: string;
  executed_at: string | null;
}

export interface SupportTicket {
  id: string;
  business_id: string;
  customer_name: string;
  customer_email: string;
  platform: string;
  message: string;
  sentiment: TicketSentiment;
  status: TicketStatus;
  ai_response: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  created_by_ai: boolean;
  created_at: string;
}

export interface ContentPost {
  id: string;
  business_id: string;
  platform: string;
  content: string;
  media_urls: string[];
  scheduled_at: string | null;
  published_at: string | null;
  status: PostStatus;
  ai_generated: boolean;
}

export interface AiUsageLog {
  id: string;
  business_id: string;
  action_type: string;
  tokens_used: number;
  cost_usd: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  business_id: string;
  actor: 'user' | 'ai';
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserOnboarding {
  id: string;
  user_id: string;
  step_completed: number;
  completed_at: string | null;
  skipped_steps: number[];
}

export interface TeamMember {
  id: string;
  business_id: string;
  user_id: string;
  role: TeamRole;
  invited_email: string | null;
  invite_token: string | null;
  created_at: string;
}

export interface Prompt {
  id: string;
  name: string;
  version: number;
  content: string;
  is_active: boolean;
  created_at: string;
}

export interface AiCostLog {
  id: string;
  business_id: string;
  provider: 'anthropic' | 'openai';
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  feature: string;
  created_at: string;
}
