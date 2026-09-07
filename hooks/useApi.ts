"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import type {
  DashboardResponse,
  PaginatedTenantsResponse,
  TenantDetail,
  FeatureCatalogItem,
  TenantBilling,
  ThemeSeeds,
  TenantAuthPolicy,
  TenantIntegration,
  AuthMethodCatalogEntry,
  IntegrationCapability,
  IntegrationOutboxMessage,
} from "@/types";

const DASHBOARD_KEY = ["platform", "dashboard"];
const TENANTS_KEY = (page: number, limit: number, search: string) =>
  ["platform", "tenants", page, limit, search];
const TENANT_KEY = (id: string) => ["platform", "tenant", id];
const FEATURE_CATALOG_KEY = ["platform", "feature-catalog"];
const AUTH_METHODS_KEY = ["platform", "auth-methods"];
const TENANT_BILLING_KEY = (tenantId: string) => ["platform", "tenant", tenantId, "billing"];
const TENANT_AUTH_POLICY_KEY = (tenantId: string) => [
  "platform",
  "tenant",
  tenantId,
  "auth-policy",
];
const TENANT_INTEGRATIONS_KEY = (tenantId: string) => [
  "platform",
  "tenant",
  tenantId,
  "integrations",
];
const INTEGRATION_CAPABILITIES_KEY = ["platform", "integration-capabilities"];
const INTEGRATION_OUTBOX_KEY = ["platform", "integrations", "outbox"];

const STALE_TIME = 2 * 60 * 1000;

export function useFeatureCatalog() {
  return useQuery({
    queryKey: FEATURE_CATALOG_KEY,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{ data?: unknown }>("/api/platform/feature-catalog");
      const list = Array.isArray(res?.data) ? res.data : [];
      return list.map((f: unknown) => {
        const r = f as Record<string, unknown>;
        return {
          key: String(r.key ?? ""),
          label: String(r.label ?? r.key ?? ""),
          category: (r.category === "core" ? "core" : "optional") as "core" | "optional",
          toggleable: Boolean(r.toggleable),
        };
      }) as FeatureCatalogItem[];
    },
  });
}

/** Every sign-in method this build can execute — what the deployed code can
 *  do, not what any one school has switched on. Mirrors `useFeatureCatalog`:
 *  a school's actual choices come from `useTenantAuthPolicy` instead. The
 *  login-access card merges the two so a method with no policy rule yet
 *  still gets a switch, rather than being unreachable until somebody edits
 *  a rule by hand. */
export function useAuthMethods() {
  return useQuery({
    queryKey: AUTH_METHODS_KEY,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{ data?: unknown }>("/api/platform/auth-methods");
      const r = (res?.data ?? {}) as Record<string, unknown>;
      const methods = Array.isArray(r.methods) ? r.methods : [];
      return methods.map((entry: unknown) => {
        const m = entry as Record<string, unknown>;
        return {
          key: String(m.key ?? ""),
          identifierType: String(m.identifier_type ?? ""),
          credentialType: (m.credential_type as string | null) ?? null,
          requiresTenant: Boolean(m.requires_tenant),
          isPaid: Boolean(m.is_paid),
          countsTowardAccountLockout: Boolean(m.counts_toward_account_lockout),
          subjectKinds: Array.isArray(m.subject_kinds)
            ? (m.subject_kinds as unknown[]).map(String)
            : [],
        };
      }) as AuthMethodCatalogEntry[];
    },
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{ data?: Record<string, unknown> }>(
        "/api/platform/dashboard"
      );
      const d = res?.data ?? {};
      return {
        metrics: {
          totalTenants: Number(d.total_tenants ?? 0),
          activeTenants: Number(d.active_tenants ?? 0),
          suspendedTenants: Number(d.suspended_tenants ?? 0),
          totalStudents: Number(d.total_students ?? 0),
          totalTeachers: Number(d.total_teachers ?? 0),
          monthlyRevenue: Number(d.revenue_monthly ?? 0),
          yearlyRevenue: Number(d.revenue_yearly ?? 0),
        },
        tenantGrowthByMonth: Array.isArray(d.tenant_growth_by_month)
          ? (d.tenant_growth_by_month as Array<{ month?: string; count?: number }>).map(
              (g) => ({
                month: String(g.month ?? ""),
                count: Number(g.count ?? 0),
              })
            )
          : [],
      } as DashboardResponse;
    },
  });
}

export function useTenants(page: number, limit: number, search = "") {
  return useQuery({
    queryKey: TENANTS_KEY(page, limit, search),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(limit),
      });
      if (search) params.set("search", search);
      const res = await api.get<{
        data?: { items?: unknown[]; pagination?: { page?: number; per_page?: number; total?: number; pages?: number } };
      }>(`/api/platform/tenants?${params.toString()}`);
      const inner = res?.data;
      const items = Array.isArray(inner?.items) ? inner.items : [];
      const pagination = inner?.pagination ?? {};
      const data = items.map((t: unknown) => {
        const r = t as Record<string, unknown>;
        return {
          id: String(r.id ?? ""),
          name: String(r.name ?? ""),
          subdomain: String(r.subdomain ?? ""),
          pricePerStudentPerYear:
            r.price_per_student_per_year != null
              ? Number(r.price_per_student_per_year)
              : null,
          discountPercentage:
            r.discount_percentage != null ? Number(r.discount_percentage) : null,
          studentsCount: Number(r.student_count ?? r.studentsCount ?? 0),
          teachersCount: Number(r.teacher_count ?? r.teachersCount ?? 0),
          status: (r.status as "active" | "suspended") || "active",
        };
      });
      return {
        data,
        total: pagination.total ?? 0,
        page: pagination.page ?? 1,
        limit: pagination.per_page ?? limit,
        totalPages: pagination.pages ?? 0,
      } as PaginatedTenantsResponse;
    },
  });
}

/** Read a `{primary, secondary?, tertiary?}` payload, or null if it isn't one. */
function readSeeds(raw: unknown): ThemeSeeds | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const seeds = raw as Record<string, unknown>;
  if (typeof seeds.primary !== "string") return null;
  return {
    primary: seeds.primary,
    ...(typeof seeds.secondary === "string" ? { secondary: seeds.secondary } : {}),
    ...(typeof seeds.tertiary === "string" ? { tertiary: seeds.tertiary } : {}),
  };
}

export function useTenant(id: string | null) {
  return useQuery({
    queryKey: TENANT_KEY(id ?? ""),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{ success?: boolean; data?: unknown }>(`/api/platform/tenants/${id}`);
      const r = (res?.data ?? {}) as Record<string, unknown>;
      const featureFlagsRaw = r.feature_flags;
      const featureFlags =
        featureFlagsRaw && typeof featureFlagsRaw === "object" && !Array.isArray(featureFlagsRaw)
          ? (featureFlagsRaw as Record<string, boolean>)
          : {};
      const statusRaw = typeof r.status === "string" ? r.status : "active";
      const status = (
        ["trial", "active", "suspended", "deleted"].includes(statusRaw) ? statusRaw : "active"
      ) as TenantDetail["status"];
      return {
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        subdomain: String(r.subdomain ?? ""),
        contactEmail: String(r.contact_email ?? r.contactEmail ?? ""),
        phone: typeof r.phone === "string" ? r.phone : undefined,
        address: typeof r.address === "string" ? r.address : undefined,
        logoUrl: typeof r.logo_url === "string" ? r.logo_url : undefined,
        tagline: typeof r.tagline === "string" ? r.tagline : undefined,
        boardAffiliation: typeof r.board_affiliation === "string" ? r.board_affiliation : undefined,
        status,
        studentsCount: Number(r.student_count ?? r.studentsCount ?? 0),
        teachersCount: Number(r.teacher_count ?? r.teachersCount ?? 0),
        createdAt: typeof r.created_at === "string" ? r.created_at : "",
        pricePerStudentPerYear:
          r.price_per_student_per_year != null ? Number(r.price_per_student_per_year) : null,
        discountPercentage:
          r.discount_percentage != null ? Number(r.discount_percentage) : null,
        discountStartDate: typeof r.discount_start_date === "string" ? r.discount_start_date : null,
        discountEndDate: typeof r.discount_end_date === "string" ? r.discount_end_date : null,
        trialEndsAt: typeof r.trial_ends_at === "string" ? r.trial_ends_at : null,
        billingCycle: typeof r.billing_cycle === "string" ? r.billing_cycle : "yearly",
        featureFlags,
        themeSeeds: readSeeds(r.theme_seeds),
        // The server is the authority on what "default" means, so the panel
        // shows the colours the app actually ships with rather than a copy
        // that can drift.
        themeDefaultSeeds: readSeeds(r.theme_default_seeds) ?? {
          primary: "#4648d4",
          secondary: "#006591",
          tertiary: "#6b38d4",
        },
      } as TenantDetail;
    },
    enabled: !!id,
  });
}

export function useTenantBilling(tenantId: string | null) {
  return useQuery({
    queryKey: TENANT_BILLING_KEY(tenantId ?? ""),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!tenantId,
    queryFn: async () => {
      const res = await api.get<{ data?: Record<string, unknown> }>(
        `/api/platform/tenants/${tenantId}/billing`
      );
      const d = res?.data ?? {};
      const window = (d.discount_window ?? {}) as Record<string, unknown>;
      return {
        tenantId: String(d.tenant_id ?? tenantId ?? ""),
        onDate: String(d.on_date ?? ""),
        activeStudents: Number(d.active_students ?? 0),
        pricePerStudentPerYear: Number(d.price_per_student_per_year ?? 0),
        baseAmount: Number(d.base_amount ?? 0),
        discountPercentage: Number(d.discount_percentage ?? 0),
        discountActive: Boolean(d.discount_active),
        discountWindow: {
          start: typeof window.start === "string" ? window.start : null,
          end: typeof window.end === "string" ? window.end : null,
        },
        discountAmount: Number(d.discount_amount ?? 0),
        total: Number(d.total ?? 0),
        currency: String(d.currency ?? "INR"),
      } as TenantBilling;
    },
  });
}

export function useInvalidateTenants() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
}

export function useInvalidateTenant(id: string | null) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: TENANT_KEY(id ?? "") });
}

export function useInvalidateTenantBilling(id: string | null) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: TENANT_BILLING_KEY(id ?? "") });
}

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
}

const AUDIT_LOGS_KEY = (page: number, perPage: number, filters: Record<string, string>) =>
  ["platform", "audit-logs", page, perPage, filters];
export function useAuditLogs(
  page: number,
  perPage: number,
  filters: { action?: string; tenant_id?: string; date_from?: string; date_to?: string } = {}
) {
  return useQuery({
    queryKey: AUDIT_LOGS_KEY(page, perPage, filters),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (filters.action) params.set("action", filters.action);
      if (filters.tenant_id) params.set("tenant_id", filters.tenant_id);
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);
      const res = await api.get<{ data?: { items?: unknown[]; pagination?: unknown } }>(
        `/api/platform/audit-logs?${params.toString()}`
      );
      const inner = (res as { data?: { items?: unknown[]; pagination?: Record<string, number> } })?.data;
      const items = Array.isArray(inner?.items) ? inner.items : [];
      const pagination = inner?.pagination ?? {};
      return {
        items,
        page: pagination.page ?? 1,
        perPage: pagination.per_page ?? perPage,
        total: pagination.total ?? 0,
        pages: pagination.pages ?? 0,
      };
    },
  });
}

const SETTINGS_KEY = ["platform", "settings"];
export function usePlatformSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{ data?: Record<string, string | null> }>("/api/platform/settings");
      return (res as { data?: Record<string, string | null> })?.data ?? {};
    },
  });
}

export function useInvalidateSettings() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
}

// --- Notification templates ---
const NOTIFICATION_TEMPLATES_KEY = (
  filters: { tenantId?: string; category?: string; type?: string; channel?: string; page: number; perPage: number }
) => ["platform", "notification-templates", filters];

export function useNotificationTemplates(filters: {
  tenantId?: string;
  category?: string;
  type?: string;
  channel?: string;
  page?: number;
  perPage?: number;
} = {}) {
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 50;
  return useQuery({
    queryKey: NOTIFICATION_TEMPLATES_KEY({
      tenantId: filters.tenantId,
      category: filters.category,
      type: filters.type,
      channel: filters.channel,
      page,
      perPage,
    }),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (filters.tenantId !== undefined && filters.tenantId !== "") {
        params.set("tenant_id", filters.tenantId === "global" ? "" : filters.tenantId);
      }
      if (filters.category) params.set("category", filters.category);
      if (filters.type) params.set("type", filters.type);
      if (filters.channel) params.set("channel", filters.channel);
      const res = await api.get<{
        data?: { items?: unknown[]; pagination?: { page?: number; per_page?: number; total?: number; pages?: number } };
      }>(`/api/platform/notification-templates?${params.toString()}`);
      const inner = res?.data;
      const items = Array.isArray(inner?.items) ? inner.items : [];
      const pagination = inner?.pagination ?? {};
      return {
        items: items.map((t: unknown) => {
          const r = t as Record<string, unknown>;
          return {
            id: String(r.id ?? ""),
            tenant_id: r.tenant_id != null ? String(r.tenant_id) : null,
            type: String(r.type ?? ""),
            channel: String(r.channel ?? ""),
            category: String(r.category ?? ""),
            is_system: Boolean(r.is_system),
            subject_template: String(r.subject_template ?? ""),
            body_template: String(r.body_template ?? ""),
            created_at: r.created_at != null ? String(r.created_at) : undefined,
            updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
          };
        }),
        pagination: {
          page: pagination.page ?? 1,
          per_page: pagination.per_page ?? perPage,
          total: pagination.total ?? 0,
          pages: pagination.pages ?? 0,
        },
      } as { items: Array<{
        id: string;
        tenant_id: string | null;
        type: string;
        channel: string;
        category: string;
        is_system: boolean;
        subject_template: string;
        body_template: string;
      }>; pagination: { page: number; per_page: number; total: number; pages: number } };
    },
  });
}

export function useInvalidateNotificationTemplates() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["platform", "notification-templates"] });
}

// --- Tenant notification settings ---
const TENANT_NOTIFICATION_SETTINGS_KEY = (tenantId: string) => [
  "platform",
  "tenant",
  tenantId,
  "notification-settings",
];

export function useTenantNotificationSettings(tenantId: string | null) {
  return useQuery({
    queryKey: TENANT_NOTIFICATION_SETTINGS_KEY(tenantId ?? ""),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{
        data?: {
          tenant_id?: string;
          templates?: unknown[];
          email_enabled?: boolean;
          sms_enabled?: boolean;
          in_app_enabled?: boolean;
        };
      }>(`/api/platform/tenants/${tenantId}/notification-settings`);
      const d = res?.data ?? {};
      const templates = Array.isArray(d.templates) ? d.templates : [];
      const emailEnabled =
        typeof d.email_enabled === "boolean"
          ? d.email_enabled
          : templates.some((t: unknown) => (t as { channel?: string }).channel === "EMAIL");
      const smsEnabled =
        typeof d.sms_enabled === "boolean"
          ? d.sms_enabled
          : templates.some((t: unknown) => (t as { channel?: string }).channel === "SMS");
      const inAppEnabled =
        typeof d.in_app_enabled === "boolean"
          ? d.in_app_enabled
          : templates.some((t: unknown) => (t as { channel?: string }).channel === "IN_APP");
      return {
        tenant_id: String(d.tenant_id ?? tenantId ?? ""),
        email_enabled: emailEnabled,
        sms_enabled: smsEnabled,
        in_app_enabled: inAppEnabled,
      };
    },
    enabled: !!tenantId,
  });
}

export function useInvalidateTenantNotificationSettings(tenantId: string | null) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: TENANT_NOTIFICATION_SETTINGS_KEY(tenantId ?? ""),
    });
}

const TENANT_ADMINS_KEY = (tenantId: string) => ["platform", "tenant", tenantId, "admins"];
export function useTenantAdmins(tenantId: string | null) {
  return useQuery({
    queryKey: TENANT_ADMINS_KEY(tenantId ?? ""),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{ data?: { admins?: unknown[] } }>(`/api/platform/tenants/${tenantId}/admins`);
      const admins = (res as { data?: { admins?: Array<{ id: string; email: string; name?: string }> } })?.data?.admins ?? [];
      return admins;
    },
    enabled: !!tenantId,
  });
}

export function useInvalidateTenantAdmins(tenantId: string | null) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: TENANT_ADMINS_KEY(tenantId ?? "") });
}

/** A school's authentication policy: which methods it permits, for which
 *  people, and its family-access, credential and OTP-channel settings. Backed
 *  by `useSetAuthMethod` and `useUpdateAuthPolicy` for writes. */
export function useTenantAuthPolicy(tenantId: string) {
  return useQuery({
    queryKey: TENANT_AUTH_POLICY_KEY(tenantId),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME,
    queryFn: async () => {
      const res = await api.get<{ data?: unknown }>(
        `/api/platform/tenants/${tenantId}/auth-policy`
      );
      const r = (res?.data ?? {}) as Record<string, unknown>;
      const rules = Array.isArray(r.rules) ? r.rules : [];
      return {
        tenantId: String(r.tenant_id ?? tenantId),
        familyAccessMode: String(r.family_access_mode ?? ""),
        studentCredentialPolicy: String(r.student_credential_policy ?? ""),
        otpDeliveryChannel: String(r.otp_delivery_channel ?? ""),
        isConfigured: Boolean(r.is_configured),
        updatedAt: (r.updated_at as string | null) ?? null,
        rules: rules.map((entry: unknown) => {
          const rule = entry as Record<string, unknown>;
          return {
            subjectKind: String(rule.subject_kind ?? ""),
            surface: String(rule.surface ?? ""),
            methodKey: String(rule.method_key ?? ""),
            isEnabled: Boolean(rule.is_enabled),
            enabledAt: (rule.enabled_at as string | null) ?? null,
            notes: (rule.notes as string | null) ?? null,
          };
        }),
      } as TenantAuthPolicy;
    },
  });
}

/** Turn one sign-in method on or off for one kind of person. */
export function useSetAuthMethod(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      methodKey: string;
      subjectKind: string;
      enabled: boolean;
      surface?: string;
    }) =>
      api.patch(`/api/platform/tenants/${tenantId}/auth-policy/methods`, {
        method_key: input.methodKey,
        subject_kind: input.subjectKind,
        enabled: input.enabled,
        surface: input.surface ?? "any",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TENANT_AUTH_POLICY_KEY(tenantId) });
    },
  });
}

/** The settings that are not methods: family access, the credential policy,
 *  and which wire carries a sign-in code. */
export function useUpdateAuthPolicy(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      familyAccessMode?: string;
      studentCredentialPolicy?: string;
      otpDeliveryChannel?: string;
    }) =>
      api.patch(`/api/platform/tenants/${tenantId}/auth-policy`, {
        family_access_mode: input.familyAccessMode,
        student_credential_policy: input.studentCredentialPolicy,
        otp_delivery_channel: input.otpDeliveryChannel,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TENANT_AUTH_POLICY_KEY(tenantId) });
    },
  });
}

/** A school's configured integrations, with a no-send readiness report for
 *  each. Backs both the login-access card's readiness banner and the full
 *  Integrations section (Task 14) — `configuration` and `credentials` are
 *  the settings/credential-name data the section's form reads and edits. */
export function useTenantIntegrations(tenantId: string) {
  return useQuery({
    queryKey: TENANT_INTEGRATIONS_KEY(tenantId),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME,
    queryFn: async () => {
      const res = await api.get<{ data?: unknown }>(
        `/api/platform/tenants/${tenantId}/integrations`
      );
      const r = (res?.data ?? {}) as Record<string, unknown>;
      const integrations = Array.isArray(r.integrations) ? r.integrations : [];
      return integrations.map((entry: unknown) => {
        const integration = entry as Record<string, unknown>;
        const health = (integration.health ?? {}) as Record<string, unknown>;
        const checks = (health.checks ?? {}) as Record<string, unknown>;
        const configuration = (integration.configuration ?? {}) as Record<string, unknown>;
        // Server field is `credentials` (see `TenantIntegration.to_dict` in
        // `server/modules/integrations/models.py`) — purpose -> {reference,
        // is_set}. Never a value; see `credentials.py`.
        const credentialsRaw = (integration.credentials ?? {}) as Record<string, unknown>;
        const credentials: Record<string, { reference: string; isSet: boolean }> = {};
        for (const [purpose, info] of Object.entries(credentialsRaw)) {
          const c = (info ?? {}) as Record<string, unknown>;
          credentials[purpose] = {
            reference: String(c.reference ?? ""),
            isSet: Boolean(c.is_set),
          };
        }
        return {
          id: String(integration.id ?? ""),
          capability: String(integration.capability ?? ""),
          providerKey: String(integration.provider_key ?? ""),
          status: String(integration.status ?? ""),
          configuration,
          credentials,
          health: {
            ready: Boolean(health.ready),
            configured: Boolean(health.configured),
            credentialsPresent: Boolean(health.credentials_present),
            providerSupported: Boolean(health.provider_supported),
            providerReachable: (health.provider_reachable as boolean | null) ?? null,
            detail: (health.detail as string | null) ?? null,
            checks: Object.fromEntries(
              Object.entries(checks).map(([k, v]) => [k, Boolean(v)])
            ),
          },
        };
      }) as TenantIntegration[];
    },
  });
}

/** Every provider this build has a client for, per capability — a property
 *  of the deployed code, not of any school's configuration. The Integrations
 *  form reads `requiredCredentials` off the selected provider to ask for
 *  exactly the right credential fields, and nothing else. */
export function useIntegrationCapabilities() {
  return useQuery({
    queryKey: INTEGRATION_CAPABILITIES_KEY,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{ data?: unknown }>(
        "/api/platform/integration-capabilities"
      );
      const r = (res?.data ?? {}) as Record<string, unknown>;
      const capabilities = Array.isArray(r.capabilities) ? r.capabilities : [];
      return capabilities.map((entry: unknown) => {
        const c = entry as Record<string, unknown>;
        const providers = Array.isArray(c.providers) ? c.providers : [];
        return {
          capability: String(c.capability ?? ""),
          label: String(c.label ?? c.capability ?? ""),
          providers: providers.map((p: unknown) => {
            const provider = p as Record<string, unknown>;
            return {
              key: String(provider.key ?? ""),
              name: String(provider.name ?? provider.key ?? ""),
              supportsIdempotency: Boolean(provider.supports_idempotency),
              isBillable: Boolean(provider.is_billable),
              isTestDouble: Boolean(provider.is_test_double),
              requiredCredentials: Array.isArray(provider.required_credentials)
                ? (provider.required_credentials as unknown[]).map(String)
                : [],
            };
          }),
        };
      }) as IntegrationCapability[];
    },
  });
}

/** Point a school's capability at a provider. **Never enables it** — the
 *  server starts a newly configured integration disabled on purpose (see
 *  `configure_integration`'s docstring), so this mutation cannot itself put
 *  traffic on the wire. `credentialReferences` must already be environment
 *  variable *names* — client-side validation happens in the form, before
 *  this is ever called; the server refuses anything else regardless. */
export function useConfigureIntegration(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      capability: string;
      providerKey: string;
      configuration: Record<string, unknown>;
      credentialReferences: Record<string, string>;
    }) =>
      api.post(`/api/platform/tenants/${tenantId}/integrations`, {
        capability: input.capability,
        provider_key: input.providerKey,
        configuration: input.configuration,
        credential_references: input.credentialReferences,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TENANT_INTEGRATIONS_KEY(tenantId) });
    },
  });
}

/** Turn one integration on or off. Disabling is refused by the server while
 *  an enabled paid sign-in method still depends on it; enabling is refused
 *  while its credentials are not present — both refusals arrive as the
 *  server's own wording via `getErrorMessage`, not reworded here. */
export function useSetIntegrationStatus(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { capability: string; status: "enabled" | "disabled" }) =>
      api.patch(
        `/api/platform/tenants/${tenantId}/integrations/${input.capability}/status`,
        { status: input.status }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TENANT_INTEGRATIONS_KEY(tenantId) });
    },
  });
}

/** Send one real message through a school's integration, to prove it works.
 *  **Not a health check** — this is billable and rings a real phone (see
 *  `server/modules/integrations/health.py`), which is why it is a distinct,
 *  operator-initiated action rather than folded into the readiness report.
 *  Rate-limited by the server to 5 per hour per operator. */
export function useTestSend(tenantId: string) {
  return useMutation({
    mutationFn: async (input: { capability: string; destination: string }) => {
      const res = await api.post<{ data?: unknown }>(
        `/api/platform/tenants/${tenantId}/integrations/${input.capability}/test-send`,
        { destination: input.destination }
      );
      const r = (res?.data ?? {}) as Record<string, unknown>;
      return {
        sent: Boolean(r.sent),
        status: String(r.status ?? ""),
        errorCode: (r.error_code as string | null) ?? null,
        errorMessage: (r.error_message as string | null) ?? null,
        operationId: (r.operation_id as string | null) ?? null,
      };
    },
  });
}

/** What a test-double provider pretended to send, for a developer to read —
 *  never real message content. **404 outside development, on purpose** (see
 *  `read_integration_outbox`): that is "unavailable", not an error, so this
 *  reports it as `available: false` rather than surfacing a failed query an
 *  operator would otherwise see on every production tenant page. */
export function useIntegrationOutbox() {
  return useQuery({
    queryKey: INTEGRATION_OUTBOX_KEY,
    staleTime: 10 * 1000,
    retry: false,
    queryFn: async (): Promise<{
      available: boolean;
      messages: IntegrationOutboxMessage[];
    }> => {
      try {
        const res = await api.get<{ data?: unknown }>(
          "/api/platform/integrations/outbox"
        );
        const r = (res?.data ?? {}) as Record<string, unknown>;
        const messages = Array.isArray(r.messages) ? r.messages : [];
        return {
          available: true,
          messages: messages.map((entry: unknown) => {
            const m = entry as Record<string, unknown>;
            return {
              tenantId: String(m.tenant_id ?? ""),
              channel: String(m.channel ?? ""),
              destination: String(m.destination ?? ""),
              body: String(m.body ?? ""),
              purpose: String(m.purpose ?? ""),
              sentAt: String(m.sent_at ?? ""),
            };
          }),
        };
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          return { available: false, messages: [] };
        }
        throw e;
      }
    },
  });
}
