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
  yearlyRevenue: number;
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
export type TenantStatus = "trial" | "active" | "suspended" | "deleted";

export interface TenantListItem {
  id: string;
  name: string;
  subdomain: string;
  pricePerStudentPerYear: number | null;
  discountPercentage: number | null;
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
  pricePerStudentPerYear: number | null;
  discountPercentage: number | null;
  discountStartDate: string | null;
  discountEndDate: string | null;
  trialEndsAt: string | null;
  billingCycle: string;
  featureFlags: Record<string, boolean>;
}

// --- Feature catalog (GET /platform/feature-catalog) ---
export interface FeatureCatalogItem {
  key: string;
  label: string;
  category: "core" | "optional";
  toggleable: boolean;
}

// --- Tenant billing (GET /platform/tenants/[id]/billing) ---
export interface TenantBilling {
  tenantId: string;
  onDate: string;
  activeStudents: number;
  pricePerStudentPerYear: number;
  baseAmount: number;
  discountPercentage: number;
  discountActive: boolean;
  discountWindow: { start: string | null; end: string | null };
  discountAmount: number;
  total: number;
  currency: string;
}

// --- Create tenant (POST /platform/tenants) ---
export interface CreateTenantPayload {
  name: string;
  subdomain: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  adminName: string;
  adminEmail: string;
  pricePerStudentPerYear?: number;
  discountPercentage?: number;
  discountStartDate?: string;
  discountEndDate?: string;
  featureFlags?: Record<string, boolean>;
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
