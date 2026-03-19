/**
 * Typed interfaces for Super Admin Panel.
 * Only includes fields documented in API spec — do not assume additional backend fields.
 */

// --- Dashboard (GET /platform/dashboard) ---
export interface DashboardMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalStudents: number;
  totalTeachers: number;
  monthlyRevenue: number;
}

export interface TenantGrowthByMonth {
  month: string;
  count: number;
}

export interface DashboardResponse {
  metrics: DashboardMetrics;
  tenantGrowthByMonth: TenantGrowthByMonth[];
}

// --- Tenants (GET /platform/tenants) ---
export type TenantStatus = "active" | "suspended";

export interface TenantListItem {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  studentsCount: number;
  teachersCount: number;
  status: TenantStatus;
}

export interface PaginatedTenantsResponse {
  data: TenantListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Tenant detail (GET /platform/tenants/[id]) ---
export interface TenantDetail {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  planId: string;
  status: TenantStatus;
  studentsCount: number;
  teachersCount: number;
  createdAt: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  tagline?: string;
  boardAffiliation?: string;
  adminName?: string;
  adminEmail?: string;
}

// --- Plan features (GET /platform/plan-features) ---
export interface PlanFeatureOption {
  key: string;
  label: string;
}

// --- Plans (GET /platform/plans) — read-only ---
export interface Plan {
  id: string;
  name: string;
  price: number;
  maxStudents: number;
  maxTeachers: number;
  /** Plan feature flags: feature_key -> enabled. Used for plan config toggles. */
  features?: Record<string, boolean>;
}

export type PlanListResponse = Plan[];

// --- Create tenant (POST /platform/tenants) ---
export interface CreateTenantPayload {
  name: string;
  subdomain: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  planId: string;
  adminName: string;
  adminEmail: string;
}

// --- Notification templates ---
export interface NotificationTemplateItem {
  id: string;
  tenant_id: string | null;
  type: string;
  channel: string;
  category: string;
  is_system: boolean;
  subject_template: string;
  body_template: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaginatedNotificationTemplatesResponse {
  items: NotificationTemplateItem[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

// --- Tenant notification settings (GET/PATCH) ---
export interface TenantNotificationTemplate {
  id: string;
  type: string;
  channel: string;
  category: string;
  subject_template: string;
  body_template: string;
}

export interface TenantNotificationSettingsResponse {
  tenant_id: string;
  templates: TenantNotificationTemplate[];
}

// --- Auth ---
export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: { email: string; name?: string };
}
