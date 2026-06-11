"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  DashboardResponse,
  PaginatedTenantsResponse,
  TenantDetail,
  FeatureCatalogItem,
  TenantBilling,
} from "@/types";

const DASHBOARD_KEY = ["platform", "dashboard"];
const TENANTS_KEY = (page: number, limit: number, search: string) =>
  ["platform", "tenants", page, limit, search];
const TENANT_KEY = (id: string) => ["platform", "tenant", id];
const FEATURE_CATALOG_KEY = ["platform", "feature-catalog"];
const TENANT_BILLING_KEY = (tenantId: string) => ["platform", "tenant", tenantId, "billing"];

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
