export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    message: string;
    code: string;
    statusCode: number;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface DashboardStats {
  mrr: number;
  activeCustomers: number;
  openTickets: number;
  scheduledPosts: number;
  pendingApprovals: number;
  leadsThisWeek: number;
  tasksDueToday: number;
}

export interface AiActionLimits {
  starter: number;
  pro: number;
  enterprise: number | null;
}

export const AI_ACTION_LIMITS: AiActionLimits = {
  starter: 500,
  pro: 2000,
  enterprise: null,
};
