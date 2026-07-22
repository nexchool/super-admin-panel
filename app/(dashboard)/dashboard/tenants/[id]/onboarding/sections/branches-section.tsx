"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import type { OnboardingConfig } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader, type SectionHeaderProps } from "./section-header";

export function BranchesSection({ title, subtitle }: SectionHeaderProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<OnboardingConfig>();

  const { fields, append, remove } = useFieldArray({ control, name: "units" });

  return (
    <section className="space-y-4">
      <SectionHeader title={title} subtitle={subtitle} />

      {errors.units?.message && (
        <p className="text-sm text-destructive">{errors.units.message}</p>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_2fr_auto]"
          >
            <div className="space-y-2">
              <Label htmlFor={`units.${index}.code`}>Code</Label>
              <Input id={`units.${index}.code`} {...register(`units.${index}.code` as const)} />
              {errors.units?.[index]?.code && (
                <p className="text-sm text-destructive">{errors.units[index]?.code?.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`units.${index}.name`}>Name</Label>
              <Input id={`units.${index}.name`} {...register(`units.${index}.name` as const)} />
              {errors.units?.[index]?.name && (
                <p className="text-sm text-destructive">{errors.units[index]?.name?.message}</p>
              )}
            </div>
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                <Trash2 className="size-4" />
                <span className="sr-only">Remove branch</span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => append({ code: "", name: "" })}
      >
        <Plus className="size-4" />
        Add branch
      </Button>
    </section>
  );
}
