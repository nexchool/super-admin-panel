"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { OnboardingConfig } from "@/lib/schemas";

export interface SubjectTemplate {
  id: string;
  name: string;
  board_code: string;
  is_active: boolean;
}

export interface ResolvedTemplate {
  subjects: Array<{ code: string; name: string; role: string | null }>;
  offerings: Array<{
    programme: string;
    grade: string;
    subjects: Array<{
      code: string;
      weekly: number;
      type: "mandatory" | "elective";
      exam_code?: string | null;
    }>;
  }>;
}

export interface EntitySummary {
  total: number;
  new: number;
  existing: number;
}

export interface SeedPreview {
  valid: boolean;
  errors: string[];
  tenant: { subdomain?: string | null; active_subdomain?: string; matches?: boolean };
  academic_year: { name?: string | null; exists: boolean; active: boolean };
  entities: Record<string, EntitySummary>;
}

export const SUBJECT_TEMPLATES_KEY = ["platform", "subject-templates"] as const;
export const ONBOARDING_DRAFT_KEY = (tenantId: string) =>
  ["platform", "tenants", tenantId, "onboarding-draft"] as const;

export function useSubjectTemplates() {
  return useQuery({
    queryKey: SUBJECT_TEMPLATES_KEY,
    queryFn: async () => {
      const res = await api.get<{ data: SubjectTemplate[] }>(
        "/api/platform/subject-templates"
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useOnboardingDraft(tenantId: string | null) {
  return useQuery({
    queryKey: ONBOARDING_DRAFT_KEY(tenantId ?? ""),
    queryFn: async () => {
      const res = await api.get<{
        data: { config: OnboardingConfig | null; updated_at: string | null };
      }>(`/api/platform/tenants/${tenantId}/onboarding-draft`);
      return res.data;
    },
    enabled: !!tenantId,
  });
}

export function useSaveOnboardingDraft(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: OnboardingConfig) => {
      const res = await api.put<{ data: { updated_at: string } }>(
        `/api/platform/tenants/${tenantId}/onboarding-draft`,
        { config }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_DRAFT_KEY(tenantId) });
    },
  });
}

export function useDiscardOnboardingDraft(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete(`/api/platform/tenants/${tenantId}/onboarding-draft`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_DRAFT_KEY(tenantId) });
    },
  });
}

// Preview only -- the form shows what a programme's template will produce. The
// result is NOT stored in the draft; the server re-derives it at apply time, so
// what a school gets always matches the catalogue as of that moment.
export function useResolveTemplate() {
  return useMutation({
    mutationFn: async (input: {
      board_code: string;
      programme_code: string;
      grades: number[];
      stream?: string | null;
    }) => {
      const res = await api.post<{ data: ResolvedTemplate }>(
        "/api/platform/subject-templates/resolve",
        input
      );
      return res.data;
    },
  });
}

export function useSeedPreview(tenantId: string) {
  return useMutation({
    mutationFn: async (config: OnboardingConfig) => {
      const res = await api.post<{ data: SeedPreview }>(
        `/api/platform/tenants/${tenantId}/seed/preview`,
        { config }
      );
      return res.data;
    },
  });
}

export function useSeedApply(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: OnboardingConfig) => {
      const res = await api.post<{
        data: {
          classes?: { created?: number };
          class_subjects?: { created?: number };
          terms?: { created?: number };
          setup_complete?: boolean;
        };
      }>(`/api/platform/tenants/${tenantId}/seed/apply`, { config });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_DRAFT_KEY(tenantId) });
    },
  });
}
