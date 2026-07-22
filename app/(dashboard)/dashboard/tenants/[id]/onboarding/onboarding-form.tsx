"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";

import { onboardingConfigSchema, type OnboardingConfig } from "@/lib/schemas";
import { useOnboardingDraft, useSaveOnboardingDraft } from "@/hooks/useOnboarding";
import { useDebouncedAutosave } from "@/hooks/useDebouncedAutosave";
import { useTenant } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcademicYearSection } from "./sections/academic-year-section";
import { BranchesSection } from "./sections/branches-section";
import { ProgrammesSection } from "./sections/programmes-section";
import { GradesSection } from "./sections/grades-section";
import { ClassesSection } from "./sections/classes-section";
import { SubjectsPreviewSection } from "./sections/subjects-preview-section";
import { ExtraSubjectsSection } from "./sections/extra-subjects-section";
import { ReviewSection } from "./sections/review-section";

/**
 * Single source of default values for the onboarding form. Valid-shaped (so
 * `zodResolver` never chokes on `undefined`) but empty — one blank branch and
 * one blank programme row so the form isn't visibly empty on first render.
 */
export const EMPTY_ONBOARDING_CONFIG: OnboardingConfig = {
  academic_year: { name: "", start: "", end: "", active: true },
  terms: [],
  units: [{ code: "", name: "" }],
  programmes: [{ code: "", name: "", board: "", medium: "", template_board_code: "" }],
  grades: [],
  classes: [],
  extra_subjects: [],
};

// `onboardingConfigSchema` uses `.default()` on a few fields (`academic_year.active`,
// `terms`, `classes`, `extra_subjects`), so zod's *input* type marks them optional
// while `OnboardingConfig` (the *output*/inferred type) requires them. `zodResolver`
// types itself as `Resolver<input, Context, output>`, so the form's field-values
// generic has to be the input shape for `useForm`/`zodResolver` to line up.
type OnboardingFormValues = z.input<typeof onboardingConfigSchema>;

/**
 * `form.watch()` returns the schema's input shape, where the `.default()`-backed
 * fields are optional. `EMPTY_ONBOARDING_CONFIG` always supplies them, so they're
 * never actually missing at runtime — this just restates that for the type
 * checker before handing the value to the save mutation, which is typed against
 * the fully-resolved `OnboardingConfig`.
 */
export function withDefaults(values: OnboardingFormValues): OnboardingConfig {
  return {
    ...values,
    academic_year: { ...values.academic_year, active: values.academic_year.active ?? true },
    terms: values.terms ?? [],
    classes: values.classes ?? [],
    extra_subjects: (values.extra_subjects ?? []).map((s) => ({
      ...s,
      weekly: s.weekly ?? 1,
      type: s.type ?? "elective",
    })),
  };
}

interface SectionStubSpec {
  title: string;
  subtitle: string;
}

// Dependency order from the plan's section map. Titles/subtitles here are the
// single source of truth for section headings — every entry (1-7) below
// renders a real input/preview component; "Review & apply" isn't numbered so
// it isn't in this array — its heading is passed to `ReviewSection` directly.
const SECTION_STUBS: SectionStubSpec[] = [
  {
    title: "1. Academic year & terms",
    subtitle: "Attendance and the timetable run inside these terms.",
  },
  {
    title: "2. Branches",
    subtitle: "Every class belongs to a branch.",
  },
  {
    title: "3. Programmes",
    subtitle:
      "The template decides which subjects each grade gets — you won't enter subjects by hand.",
  },
  {
    title: "4. Grades",
    subtitle:
      "Numeric grades draw subjects from the template; pre-primary grades get theirs from Extra subjects.",
  },
  {
    title: "5. Classes",
    subtitle: "Sections are per grade — Std 9-A and 9-B share everything but the section letter.",
  },
  {
    title: "6. Subjects (derived)",
    subtitle: "Read-only preview of what the server will derive from your programmes and grades.",
  },
  {
    title: "7. Extra subjects",
    subtitle:
      "For anything the board doesn't prescribe — pre-primary, or a school-specific subject.",
  },
];

interface OnboardingFormProps {
  tenantId: string;
}

export function OnboardingForm({ tenantId }: OnboardingFormProps) {
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useTenant(tenantId);
  const {
    data: draft,
    isLoading: draftLoading,
    isSuccess: draftLoadSucceeded,
    isError: draftLoadFailed,
  } = useOnboardingDraft(tenantId);
  const saveDraft = useSaveOnboardingDraft(tenantId);

  // Context (2nd generic) is unused here, matching react-hook-form's own default of `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<OnboardingFormValues, any, OnboardingConfig>({
    resolver: zodResolver(onboardingConfigSchema),
    defaultValues: EMPTY_ONBOARDING_CONFIG,
  });

  // Gate: only reset once, the first time the draft query resolves. Without
  // the `loaded` guard, a later refetch/invalidate (e.g. after a save) would
  // reset the form and blow away whatever the operator is mid-typing.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!draftLoadSucceeded || loaded) return;
    if (draft?.config) {
      form.reset(draft.config);
    }
    setLoaded(true);
  }, [draftLoadSucceeded, draft, loaded, form]);

  const values = withDefaults(form.watch());
  useDebouncedAutosave(values, (cfg) => saveDraft.mutate(cfg), { enabled: loaded });

  if (tenantLoading || draftLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="p-8">
        <p className="text-destructive">
          {tenantError instanceof Error ? tenantError.message : "Tenant not found"}
        </p>
        <Button variant="link" asChild className="mt-4 px-0">
          <Link href="/dashboard/tenants">Back to tenants</Link>
        </Button>
      </div>
    );
  }

  // The backend only seeds ACTIVE tenants; match the gate `onboarding-section.tsx` uses.
  if (tenant.status !== "active") {
    return (
      <div className="p-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/tenants/${tenantId}`}>
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Only active tenants can be onboarded. Activate this tenant first.
        </p>
      </div>
    );
  }

  let saveStatus: "Saving…" | "Saved" | null = null;
  if (saveDraft.isPending) {
    saveStatus = "Saving…";
  } else if (loaded && saveDraft.isSuccess) {
    saveStatus = "Saved";
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/tenants/${tenantId}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Set up academic structure</h1>
          <p className="text-sm text-muted-foreground">{tenant.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          {saveStatus === "Saving…" ? <Loader2 className="size-4 animate-spin" /> : null}
          {saveStatus}
        </div>
      </div>

      {draftLoadFailed ? (
        <p className="mb-4 text-sm text-destructive">
          Couldn&apos;t load the saved draft — autosave is paused until this page is reloaded.
        </p>
      ) : null}

      <FormProvider {...form}>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Onboarding</CardTitle>
            <p className="text-sm text-muted-foreground">
              Fill in each section below. Subjects are derived automatically — you never enter
              them directly.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-8">
            <AcademicYearSection {...SECTION_STUBS[0]} />
            <BranchesSection {...SECTION_STUBS[1]} />
            <ProgrammesSection {...SECTION_STUBS[2]} />
            <GradesSection {...SECTION_STUBS[3]} />
            <ClassesSection {...SECTION_STUBS[4]} />
            <SubjectsPreviewSection {...SECTION_STUBS[5]} />
            <ExtraSubjectsSection {...SECTION_STUBS[6]} />
            <ReviewSection
              title="Review & apply"
              subtitle="Check the configuration and apply once everything above looks right."
              tenantId={tenantId}
            />
          </CardContent>
        </Card>
      </FormProvider>
    </div>
  );
}
