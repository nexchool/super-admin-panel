"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  DashboardResponse,
  PaginatedTenantsResponse,
  TenantDetail,
  PlanListResponse,
  PlanFeatureOption,
} from "@/types";

const DASHBOARD_KEY = ["platform", "dashboard"];
const TENANTS_KEY = (page: number, limit: number) =>
  ["platform", "tenants", page, limit];
const TENANT_KEY = (id: string) => ["platform", "tenant", id];
const PLANS_KEY = ["platform", "plans"];
const PLAN_FEATURES_KEY = ["platform", "plan-features"];

/** Reduces refetch storms when navigating; data stays fresh for 2 min */
const STALE_TIME = 2 * 60 * 1000;

export function usePlanFeatures() {
  return useQuery({
    queryKey: PLAN_FEATURES_KEY,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{ data?: unknown }>("/api/platform/plan-features");
      const list = Array.isArray(res?.data) ? res.data : [];
      return list.map((f: { key?: string; label?: string }) => ({
        key: String(f.key ?? ""),
        label: String(f.label ?? f.key ?? ""),
      })) as PlanFeatureOption[];
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

export function useTenants(page: number, limit: number) {
  return useQuery({
    queryKey: TENANTS_KEY(page, limit),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{
        data?: { items?: unknown[]; pagination?: { page?: number; per_page?: number; total?: number; pages?: number } };
      }>(`/api/platform/tenants?page=${page}&per_page=${limit}`);
      const inner = res?.data;
      const items = Array.isArray(inner?.items) ? inner.items : [];
      const pagination = inner?.pagination ?? {};
      const data = items.map((t: unknown) => {
        const r = t as Record<string, unknown>;
        return {
          id: String(r.id ?? ""),
          name: String(r.name ?? ""),
          subdomain: String(r.subdomain ?? ""),
          plan: String(r.plan_name ?? r.plan ?? ""),
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
      return {
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        subdomain: String(r.subdomain ?? ""),
        contactEmail: String(r.contact_email ?? r.contactEmail ?? ""),
        phone: typeof r.phone === "string" ? r.phone : undefined,
        address: typeof r.address === "string" ? r.address : undefined,
        plan: String(r.plan_name ?? r.plan ?? ""),
        planId: String(r.plan_id ?? r.planId ?? ""),
        status: (r.status as "active" | "suspended") || "active",
        studentsCount: Number(r.student_count ?? r.studentsCount ?? 0),
        teachersCount: Number(r.teacher_count ?? r.teachersCount ?? 0),
        createdAt: typeof r.created_at === "string" ? r.created_at : typeof r.createdAt === "string" ? r.createdAt : "",
      } as TenantDetail;
    },
    enabled: !!id,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: PLANS_KEY,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await api.get<{ data?: unknown }>("/api/platform/plans");
      const list = Array.isArray(res?.data) ? res.data : [];
      return list.map((p: Record<string, unknown>) => {
        const rawFeatures = p.features_json ?? p.features;
        const features =
          rawFeatures && typeof rawFeatures === "object" && !Array.isArray(rawFeatures)
            ? (rawFeatures as Record<string, boolean>)
            : undefined;
        return {
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          price: Number(p.price ?? p.price_monthly ?? 0),
          maxStudents: Number(p.maxStudents ?? p.max_students ?? 0),
          maxTeachers: Number(p.maxTeachers ?? p.max_teachers ?? 0),
          features,
        };
      }) as PlanListResponse;
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

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
}

export function useInvalidatePlans() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PLANS_KEY });
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
