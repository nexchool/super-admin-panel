"use client";

import { useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCheck, FileCheck2, Loader2 } from "lucide-react";

import type { OnboardingConfig } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/api";
import { useSeedApply, useSeedPreview } from "@/hooks/useOnboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader, type SectionHeaderProps } from "./section-header";
import { withDefaults } from "../onboarding-form";

// Reused from the pre-Task-1 `onboarding-section.tsx` (recovered via
// `git show b06fcb9`) — the diff table shape hasn't changed, only the
// entities the server reports have grown. `terms` is new: the old code
// predates the server returning a `terms` entity in the seed diff.
const ENTITY_ORDER = [
  ["terms", "Terms"],
  ["units", "Branches"],
  ["programmes", "Programmes"],
  ["grades", "Grades"],
  ["subjects", "Subjects"],
  ["offerings", "Subject offerings"],
  ["classes", "Classes"],
] as const;

interface ReviewSectionProps extends SectionHeaderProps {
  tenantId: string;
}

export function ReviewSection({ title, subtitle, tenantId }: ReviewSectionProps) {
  const form = useFormContext<OnboardingConfig>();
  const router = useRouter();
  const preview = useSeedPreview(tenantId);
  const apply = useSeedApply(tenantId);

  const handleCheck = () => {
    preview.mutate(withDefaults(form.getValues()));
  };

  const handleApply = () => {
    if (!preview.data?.valid) return;
    apply.mutate(withDefaults(form.getValues()), {
      onSuccess: (result) => {
        toast.success(
          `Created ${result.classes?.created ?? 0} class(es), ` +
            `${result.class_subjects?.created ?? 0} subject link(s), and ` +
            `${result.terms?.created ?? 0} term(s).`
        );
        router.push(`/dashboard/tenants/${tenantId}`);
      },
      onError: (e) => {
        toast.error(getErrorMessage(e));
      },
    });
  };

  const data = preview.data;
  const subdomainMismatch = data?.tenant?.matches === false && data?.tenant?.subdomain;

  return (
    <section className="space-y-4">
      <SectionHeader title={title} subtitle={subtitle} />

      <p className="text-sm text-muted-foreground">
        Applying only <strong>creates</strong> records that don&apos;t exist yet — it never
        removes or overwrites anything already in this tenant. It&apos;s safe to check and apply
        again after you add more classes, terms, or extra subjects later.
      </p>

      {preview.isError && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {getErrorMessage(preview.error)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={handleCheck}
          disabled={preview.isPending}
        >
          {preview.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ClipboardCheck className="size-4" />
          )}
          {preview.isPending ? "Checking…" : "Check configuration"}
        </Button>
        <Button
          type="button"
          className="gap-2"
          onClick={handleApply}
          disabled={!data?.valid || preview.isPending || apply.isPending}
        >
          {apply.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileCheck2 className="size-4" />
          )}
          {apply.isPending ? "Applying…" : "Apply"}
        </Button>
      </div>

      {data && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          {data.errors.length > 0 && (
            <div className="space-y-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4" /> Configuration has errors — fix and check
                again:
              </div>
              <ul className="ml-6 list-disc">
                {data.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {subdomainMismatch && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Note: the config&apos;s subdomain ({data.tenant.subdomain}) differs from this
              tenant&apos;s active subdomain ({data.tenant.active_subdomain}). It will still
              apply to this tenant — the subdomain field is advisory.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Entity</th>
                  <th className="pb-2 text-right font-medium">New</th>
                  <th className="pb-2 text-right font-medium">Existing</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="py-2">Academic year</td>
                  <td className="py-2 text-right">
                    {data.academic_year.exists ? 0 : data.academic_year.name ? 1 : 0}
                  </td>
                  <td className="py-2 text-right">{data.academic_year.exists ? 1 : 0}</td>
                  <td className="py-2 text-right">{data.academic_year.name ? 1 : 0}</td>
                </tr>
                {ENTITY_ORDER.map(([key, label]) => {
                  const s = data.entities[key];
                  if (!s) return null;
                  return (
                    <tr key={key} className="border-t border-border">
                      <td className="py-2">{label}</td>
                      <td className="py-2 text-right font-medium text-foreground">{s.new}</td>
                      <td className="py-2 text-right text-muted-foreground">{s.existing}</td>
                      <td className="py-2 text-right">{s.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Badge variant={data.valid ? "success" : "destructive"}>
            {data.valid ? "Ready to apply" : "Not applyable"}
          </Badge>
        </div>
      )}
    </section>
  );
}
