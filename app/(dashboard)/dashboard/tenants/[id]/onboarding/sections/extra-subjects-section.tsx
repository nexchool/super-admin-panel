"use client";

import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import type { OnboardingConfig } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader, type SectionHeaderProps } from "./section-header";

export function ExtraSubjectsSection({ title, subtitle }: SectionHeaderProps) {
  const { control } = useFormContext<OnboardingConfig>();
  const { fields, append, remove } = useFieldArray({ control, name: "extra_subjects" });
  const programmes = useWatch({ control, name: "programmes" }) ?? [];
  const grades = useWatch({ control, name: "grades" }) ?? [];

  const validProgrammes = programmes.filter((p) => p.code.trim() !== "");
  const validGrades = grades.filter((g) => g.name.trim() !== "");

  return (
    <section className="space-y-4">
      <SectionHeader title={title} subtitle={subtitle} />

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No extra subjects yet — optional.</p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <ExtraSubjectRow
              key={field.id}
              index={index}
              programmes={validProgrammes}
              grades={validGrades}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() =>
          append({ code: "", name: "", programme: "", grades: [], weekly: 1, type: "elective" })
        }
      >
        <Plus className="size-4" />
        Add extra subject
      </Button>
    </section>
  );
}

interface ExtraSubjectRowProps {
  index: number;
  programmes: { code: string; name: string }[];
  grades: { name: string }[];
  onRemove: () => void;
}

// Its own component (not inlined in the parent's `.map`) so `useWatch` can
// read this row's programme/type/grades live without calling a hook inside a
// loop — `fields[index]` from `useFieldArray` only reflects append-time
// values, not later `setValue` updates.
function ExtraSubjectRow({ index, programmes, grades, onRemove }: ExtraSubjectRowProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<OnboardingConfig>();
  const programme = useWatch({ control, name: `extra_subjects.${index}.programme` });
  const type = useWatch({ control, name: `extra_subjects.${index}.type` });
  const selectedGrades = useWatch({ control, name: `extra_subjects.${index}.grades` }) ?? [];
  const rowErrors = errors.extra_subjects?.[index];

  const toggleGrade = (gradeName: string) => {
    const next = selectedGrades.includes(gradeName)
      ? selectedGrades.filter((g) => g !== gradeName)
      : [...selectedGrades, gradeName];
    setValue(`extra_subjects.${index}.grades`, next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor={`extra_subjects.${index}.code`}>Code</Label>
          <Input
            id={`extra_subjects.${index}.code`}
            {...register(`extra_subjects.${index}.code` as const)}
          />
          {rowErrors?.code && <p className="text-sm text-destructive">{rowErrors.code.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`extra_subjects.${index}.name`}>Name</Label>
          <Input
            id={`extra_subjects.${index}.name`}
            {...register(`extra_subjects.${index}.name` as const)}
          />
          {rowErrors?.name && <p className="text-sm text-destructive">{rowErrors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`extra_subjects.${index}.weekly`}>Weekly periods</Label>
          <Input
            id={`extra_subjects.${index}.weekly`}
            type="number"
            min="1"
            {...register(`extra_subjects.${index}.weekly` as const, { valueAsNumber: true })}
          />
          {rowErrors?.weekly && (
            <p className="text-sm text-destructive">{rowErrors.weekly.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`extra_subjects.${index}.type`}>Type</Label>
          <Select
            value={type || "elective"}
            onValueChange={(value) =>
              setValue(`extra_subjects.${index}.type`, value as "mandatory" | "elective", {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id={`extra_subjects.${index}.type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mandatory">Mandatory</SelectItem>
              <SelectItem value="elective">Elective</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`extra_subjects.${index}.programme`}>Programme</Label>
        <Select
          value={programme || undefined}
          onValueChange={(value) =>
            setValue(`extra_subjects.${index}.programme`, value, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          disabled={programmes.length === 0}
        >
          <SelectTrigger id={`extra_subjects.${index}.programme`}>
            <SelectValue
              placeholder={programmes.length === 0 ? "Add a programme first" : "Select a programme"}
            />
          </SelectTrigger>
          <SelectContent>
            {programmes.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.name || p.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rowErrors?.programme && (
          <p className="text-sm text-destructive">{rowErrors.programme.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Grades</Label>
        {grades.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add grades first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {grades.map((g) => {
              const active = selectedGrades.includes(g.name);
              return (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => toggleGrade(g.name)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
        {rowErrors?.grades?.message && (
          <p className="text-sm text-destructive">{rowErrors.grades.message}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={onRemove}>
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
    </div>
  );
}
