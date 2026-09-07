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
  /** The school's brand colours; null until somebody sets a theme. */
  themeSeeds: ThemeSeeds | null;
  /** What the app ships with — shown as the starting point when unthemed. */
  themeDefaultSeeds: ThemeSeeds;
}

/**
 * The two or three colours a school is branded by. Everything else the mobile
 * app draws is derived from these server-side (server/core/theme.py), so this
 * is the whole of what an operator edits.
 */
export interface ThemeSeeds {
  primary: string;
  secondary?: string;
  tertiary?: string;
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

/** One permission in a school's authentication policy: this kind of person, on
 *  this surface, may use this method. Writable from the panel via
 *  `useSetAuthMethod`. */
export type AuthPolicyRule = {
  subjectKind: string;
  surface: string;
  methodKey: string;
  isEnabled: boolean;
  enabledAt: string | null;
  notes: string | null;
};

/** Which ways in a school allows, and its family-access, credential and OTP
 *  channel settings. Writable from the panel via `useSetAuthMethod` and
 *  `useUpdateAuthPolicy` — this is what governs who may sign in. */
export type TenantAuthPolicy = {
  tenantId: string;
  familyAccessMode: string;
  studentCredentialPolicy: string;
  otpDeliveryChannel: string;
  isConfigured: boolean;
  updatedAt: string | null;
  rules: AuthPolicyRule[];
};

/** A school's readiness report for one integration capability (e.g. "sms"),
 *  without sending anything to produce it. `checks` is the server's own
 *  named checklist (`integration_row`, `enabled`, `provider_supported`,
 *  `credentials_present`) — shown as a breakdown, never re-derived client
 *  side. `providerReachable` is `null` whenever the vendor offers no free
 *  non-sending check (both real providers today); `detail` then already
 *  carries the server's "Delivery was not verified…" sentence, so the panel
 *  renders it rather than inventing its own wording. */
export type IntegrationHealth = {
  ready: boolean;
  configured: boolean;
  credentialsPresent: boolean;
  providerSupported: boolean;
  providerReachable: boolean | null;
  detail: string | null;
  checks?: Record<string, boolean>;
};

/** What an operator may see about one stored credential: the environment
 *  variable *name* it points at, and whether that name currently resolves on
 *  this server. Never a value — see `server/modules/integrations/credentials.py`. */
export type IntegrationCredentialInfo = {
  reference: string;
  isSet: boolean;
};

export type TenantIntegration = {
  id: string;
  capability: string;
  providerKey: string;
  status: string;
  health: IntegrationHealth;
  /** Non-secret settings — sender id, phone number id, template ids. Absent
   *  on the minimal shape older callers (the login-access readiness banner)
   *  still use. */
  configuration?: Record<string, unknown>;
  /** Purpose → credential info. Keys are whatever the operator chose when
   *  configuring; see `IntegrationCredentialInfo`. */
  credentials?: Record<string, IntegrationCredentialInfo>;
};

/** One provider this build has a client for, within one capability — from
 *  `GET /platform/integration-capabilities`. A property of the deployed
 *  code, not of any school's configuration; `requiredCredentials` names the
 *  environment variables that provider's client reads, which is what the
 *  Integrations form uses to ask for exactly the right credential fields. */
export type IntegrationProvider = {
  key: string;
  name: string;
  supportsIdempotency: boolean;
  isBillable: boolean;
  isTestDouble: boolean;
  requiredCredentials: string[];
};

export type IntegrationCapability = {
  capability: string;
  label: string;
  providers: IntegrationProvider[];
};

/** One message a test-double provider pretended to send, from the
 *  development-only outbox. Never populated by a real provider — see
 *  `server/modules/integrations/outbox.py`. */
export type IntegrationOutboxMessage = {
  tenantId: string;
  channel: string;
  destination: string;
  body: string;
  purpose: string;
  sentAt: string;
};

/** One sign-in method this build can execute (GET /platform/auth-methods) —
 *  a property of the deployed code, not of any school's configuration. The
 *  login-access card merges this catalog with a school's `AuthPolicyRule`s
 *  so a method with no rule yet still gets a switch, defaulted off, instead
 *  of disappearing. `isPaid` is what tells the card a method needs a working
 *  messaging channel; it replaces a hardcoded list of paid method keys that
 *  would otherwise go stale the moment a second paid method ships.
 *  `subjectKinds` is the same move for who a method can ever serve: `mobile_pin`
 *  is students-only, and the card reads this to skip rendering a switch that
 *  would report success and never actually let anyone in, instead of
 *  offering every method under every column. */
export type AuthMethodCatalogEntry = {
  key: string;
  identifierType: string;
  credentialType: string | null;
  requiresTenant: boolean;
  isPaid: boolean;
  countsTowardAccountLockout: boolean;
  subjectKinds: string[];
};
