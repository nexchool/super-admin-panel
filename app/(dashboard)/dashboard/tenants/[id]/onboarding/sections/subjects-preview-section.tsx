"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AlertTriangle, Eye, Loader2 } from "lucide-react";

import type { OnboardingConfig } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/api";
import { useResolveTemplate, type ResolvedTemplate } from "@/hooks/useOnboarding";
import { Button } from "@/components/ui/button";
import { SectionHeader, type SectionHeaderProps } from "./section-header";

interface ProgrammePreview {
  programmeCode: string;
  programmeName: string;
  result?: ResolvedTemplate;
  error?: string;
}

/**
 * Read-only preview of the subjects the server will derive at apply time.
 * Nothing here is editable and nothing here is saved to the draft — the
 * server re-derives from each programme's `template_board_code` at apply, so
 * this is purely a "here's what you'll get" confirmation, not an input.
 */
export function SubjectsPreviewSection({ title, subtitle }: SectionHeaderProps) {
  const { control } = useFormContext<OnboardingConfig>();
  const programmes = useWatch({ control, name: "programmes" }) ?? [];
  const grades = useWatch({ control, name: "grades" }) ?? [];
  const extraSubjects = useWatch({ control, name: "extra_subjects" }) ?? [];

  const resolveTemplate = useResolveTemplate();
  const [previews, setPreviews] = useState<ProgrammePreview[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewedSnapshot, setPreviewedSnapshot] = useState<string | null>(null);

  const validProgrammes = programmes.filter(
    (p) => p.code.trim() !== "" && p.template_board_code.trim() !== ""
  );
  const skippedProgrammes = programmes.filter(
    (p) => p.code.trim() !== "" && p.template_board_code.trim() === ""
  );
  const numericGrades = grades
    .filter((g) => g.name.trim() !== "" && Number.isInteger(Number(g.name)) && Number(g.name) > 0)
    .sort((a, b) => a.sequence - b.sequence);
  const nonNumericGrades = grades.filter(
    (g) => g.name.trim() !== "" && !(Number.isInteger(Number(g.name)) && Number(g.name) > 0)
  );

  const canPreview = validProgrammes.length > 0 && numericGrades.length > 0;
  const currentSnapshot = JSON.stringify({ validProgrammes, numericGrades });
  const isStale = previews !== null && previewedSnapshot !== currentSnapshot;

  const handlePreview = async () => {
    if (!canPreview) return;
    setLoading(true);
    const gradeNumbers = numericGrades.map((g) => Number(g.name));
    const results: ProgrammePreview[] = [];
    for (const programme of validProgrammes) {
      try {
        const result = await resolveTemplate.mutateAsync({
          board_code: programme.template_board_code,
          programme_code: programme.code,
          grades: gradeNumbers,
        });
        results.push({ programmeCode: programme.code, programmeName: programme.name, result });
      } catch (e) {
        results.push({
          programmeCode: programme.code,
          programmeName: programme.name,
          error: getErrorMessage(e),
        });
      }
    }
    setPreviews(results);
    setPreviewedSnapshot(currentSnapshot);
    setLoading(false);
  };

  return (
    <section className="space-y-4">
      <SectionHeader title={title} subtitle={subtitle} />

      <p className="text-sm text-muted-foreground">
        This preview shows what the server will derive from each programme&apos;s curriculum
        template — it is read-only. You confirm it here; you don&apos;t edit it. The server
        re-derives the same thing again at apply time, so what a school gets always matches the
        catalogue as of that moment.
      </p>

      {validProgrammes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add a programme with a curriculum template (Section 3) to preview its subjects.
        </p>
      )}
      {numericGrades.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add at least one numeric grade (Section 4) to preview subjects.
        </p>
      )}
      {skippedProgrammes.length > 0 && (
        <p className="text-xs italic text-muted-foreground">
          Skipping{" "}
          {skippedProgrammes.map((p) => p.name || p.code).join(", ")} — no curriculum template
          selected yet.
        </p>
      )}
      {nonNumericGrades.length > 0 && (
        <p className="text-xs italic text-muted-foreground">
          {nonNumericGrades.map((g) => g.name).join(", ")} won&apos;t draw template subjects —
          non-numeric grades get theirs from Extra subjects instead.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handlePreview}
        disabled={!canPreview || loading}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
        {loading ? "Previewing…" : "Preview subjects"}
      </Button>

      {isStale && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3.5" />
          Programmes or grades changed since this preview ran — click Preview again to refresh it.
        </p>
      )}

      {previews && (
        <div className="space-y-3">
          {previews.map((preview) => (
            <div
              key={preview.programmeCode}
              className="space-y-3 rounded-lg border border-border p-3"
            >
              <h4 className="text-sm font-medium">
                {preview.programmeName || preview.programmeCode}
              </h4>
              {preview.error ? (
                <p className="text-sm text-destructive">{preview.error}</p>
              ) : (
                <div className="space-y-3">
                  {numericGrades.map((grade) => {
                    const offering = preview.result?.offerings.find(
                      (o) => Number(o.grade) === Number(grade.name)
                    );
                    const subjectsForGrade = offering?.subjects ?? [];
                    const subjectName = (code: string) =>
                      preview.result?.subjects.find((s) => s.code === code)?.name ?? code;
                    return (
                      <div key={grade.name}>
                        <p className="text-xs font-medium text-muted-foreground">
                          Grade {grade.name}
                        </p>
                        {subjectsForGrade.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No subjects returned for this grade.
                          </p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {subjectsForGrade.map((s) => (
                              <li
                                key={s.code}
                                className="flex items-center justify-between text-sm"
                              >
                                <span>
                                  {subjectName(s.code)}{" "}
                                  <span className="text-xs text-muted-foreground">
                                    ({s.code})
                                  </span>
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {s.weekly}/wk · {s.type}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <h4 className="text-sm font-medium">Extra subjects that will layer on</h4>
        {extraSubjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet — anything added in Section 7 adds to the derived subjects above; it never
            replaces one.
          </p>
        ) : (
          <ul className="space-y-1">
            {extraSubjects.map((s, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span>
                  {s.name || s.code}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({s.code}) · {s.programme || "—"} · grade{s.grades.length === 1 ? "" : "s"}{" "}
                    {s.grades.join(", ") || "—"}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.weekly}/wk · {s.type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
