"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import type { OnboardingConfig } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader, type SectionHeaderProps } from "./section-header";

// `useFormContext<T>()` doesn't check its generic against the provider's —
// `OnboardingConfig` (the resolved/output shape) is what every section reads
// with, per the shell's own typing note in `onboarding-form.tsx`.
export function AcademicYearSection({ title, subtitle }: SectionHeaderProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<OnboardingConfig>();

  const { fields, append, remove } = useFieldArray({ control, name: "terms" });

  return (
    <section className="space-y-4">
      <SectionHeader title={title} subtitle={subtitle} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="academic_year.name">Year name</Label>
          <Input
            id="academic_year.name"
            placeholder="2026-27"
            {...register("academic_year.name")}
          />
          {errors.academic_year?.name && (
            <p className="text-sm text-destructive">{errors.academic_year.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="academic_year.start">Start date</Label>
          <Input id="academic_year.start" type="date" {...register("academic_year.start")} />
          {errors.academic_year?.start && (
            <p className="text-sm text-destructive">{errors.academic_year.start.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="academic_year.end">End date</Label>
          <Input id="academic_year.end" type="date" {...register("academic_year.end")} />
          {errors.academic_year?.end && (
            <p className="text-sm text-destructive">{errors.academic_year.end.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Terms</h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() =>
              append({ name: "", code: "", sequence: fields.length + 1, start: "", end: "" })
            }
          >
            <Plus className="size-4" />
            Add term
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No terms yet.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-5"
              >
                <div className="space-y-2">
                  <Label htmlFor={`terms.${index}.name`}>Name</Label>
                  <Input id={`terms.${index}.name`} {...register(`terms.${index}.name` as const)} />
                  {errors.terms?.[index]?.name && (
                    <p className="text-sm text-destructive">
                      {errors.terms[index]?.name?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`terms.${index}.code`}>Code</Label>
                  <Input id={`terms.${index}.code`} {...register(`terms.${index}.code` as const)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`terms.${index}.sequence`}>Sequence</Label>
                  <Input
                    id={`terms.${index}.sequence`}
                    type="number"
                    min="1"
                    {...register(`terms.${index}.sequence` as const, { valueAsNumber: true })}
                  />
                  {errors.terms?.[index]?.sequence && (
                    <p className="text-sm text-destructive">
                      {errors.terms[index]?.sequence?.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`terms.${index}.start`}>Start</Label>
                  <Input
                    id={`terms.${index}.start`}
                    type="date"
                    {...register(`terms.${index}.start` as const)}
                  />
                  {errors.terms?.[index]?.start && (
                    <p className="text-sm text-destructive">
                      {errors.terms[index]?.start?.message}
                    </p>
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`terms.${index}.end`}>End</Label>
                    <Input
                      id={`terms.${index}.end`}
                      type="date"
                      {...register(`terms.${index}.end` as const)}
                    />
                    {errors.terms?.[index]?.end && (
                      <p className="text-sm text-destructive">
                        {errors.terms[index]?.end?.message}
                      </p>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove term</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
