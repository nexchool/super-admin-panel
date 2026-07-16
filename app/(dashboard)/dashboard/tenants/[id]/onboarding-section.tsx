"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileCheck2, AlertTriangle } from "lucide-react";

import { api, getErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type EntitySummary = { total: number; new: number; existing: number };

type SeedPreview = {
  valid: boolean;
  errors: string[];
  tenant: { subdomain?: string | null; active_subdomain?: string; matches?: boolean };
  academic_year: { name?: string | null; exists: boolean; active: boolean };
  entities: Record<string, EntitySummary>;
};

type SeedApplyResult = {
  classes?: { created?: number };
  class_subjects?: { created?: number };
  setup_complete?: boolean;
};

const ENTITY_ORDER = [
  ["units", "Branches"],
  ["programmes", "Programmes"],
  ["grades", "Grades"],
  ["subjects", "Subjects"],
  ["offerings", "Subject offerings"],
  ["classes", "Classes"],
] as const;

interface OnboardingSectionProps {
  tenantId: string;
  tenantStatus?: string;
  onApplied?: () => void;
}

export function OnboardingSection({
  tenantId,
  tenantStatus,
  onApplied,
}: OnboardingSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SeedPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

  // The backend only seeds ACTIVE tenants; hide the tool otherwise so the
  // operator isn't handed a button that will 404.
  if (tenantStatus && tenantStatus !== "active") return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePreview = async () => {
    if (!file) return;
    setBusy("preview");
    setPreview(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.postForm<{ data: SeedPreview }>(
        `/api/platform/tenants/${tenantId}/seed/preview`,
        form
      );
      setPreview(res.data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const handleApply = async () => {
    if (!file || !preview?.valid) return;
    setBusy("apply");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.postForm<{ data: SeedApplyResult }>(
        `/api/platform/tenants/${tenantId}/seed/apply`,
        form
      );
      const d = res.data;
      toast.success(
        `Seeded ${d.classes?.created ?? 0} class(es) and ${d.class_subjects?.created ?? 0} subject link(s).`
      );
      reset();
      onApplied?.();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const subdomainMismatch =
    preview?.tenant?.matches === false && preview?.tenant?.subdomain;

  return (
    <Card className="mt-6 rounded-xl">
      <CardHeader>
        <CardTitle>Onboarding</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload a school config (.yaml / .json) to seed branches, programmes,
          grades, subjects, and classes for this tenant. Preview first — nothing
          is written until you apply.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".yaml,.yml,.json"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
          <Button
            variant="outline"
            className="gap-2"
            onClick={handlePreview}
            disabled={!file || busy !== null}
          >
            <Upload className="size-4" />
            {busy === "preview" ? "Checking…" : "Preview"}
          </Button>
        </div>

        {preview ? (
          <div className="space-y-4 rounded-lg border border-border p-4">
            {preview.errors.length > 0 ? (
              <div className="space-y-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4" /> Config has errors — fix and
                  re-upload:
                </div>
                <ul className="ml-6 list-disc">
                  {preview.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {subdomainMismatch ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Note: the config&apos;s <code>tenant.subdomain</code> (
                {preview.tenant.subdomain}) differs from this tenant (
                {preview.tenant.active_subdomain}). It will still apply to this
                tenant — the subdomain field is advisory.
              </p>
            ) : null}

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
                      {preview.academic_year.exists ? 0 : preview.academic_year.name ? 1 : 0}
                    </td>
                    <td className="py-2 text-right">
                      {preview.academic_year.exists ? 1 : 0}
                    </td>
                    <td className="py-2 text-right">
                      {preview.academic_year.name ? 1 : 0}
                    </td>
                  </tr>
                  {ENTITY_ORDER.map(([key, label]) => {
                    const s = preview.entities[key];
                    if (!s) return null;
                    return (
                      <tr key={key} className="border-t border-border">
                        <td className="py-2">{label}</td>
                        <td className="py-2 text-right font-medium text-foreground">
                          {s.new}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {s.existing}
                        </td>
                        <td className="py-2 text-right">{s.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Badge variant={preview.valid ? "success" : "destructive"}>
                {preview.valid ? "Ready to apply" : "Not applyable"}
              </Badge>
              <Button
                className="gap-2"
                onClick={handleApply}
                disabled={!preview.valid || busy !== null}
              >
                <FileCheck2 className="size-4" />
                {busy === "apply" ? "Applying…" : "Apply to this tenant"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
