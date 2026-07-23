"use client";

import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import type { OnboardingConfig } from "@/lib/schemas";
import { useSubjectTemplates, type SubjectTemplate } from "@/hooks/useOnboarding";
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

export function ProgrammesSection({ title, subtitle }: SectionHeaderProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<OnboardingConfig>();
  const { fields, append, remove } = useFieldArray({ control, name: "programmes" });
  const { data: templates, isLoading: templatesLoading } = useSubjectTemplates();

  return (
    <section className="space-y-4">
      <SectionHeader title={title} subtitle={subtitle} />

      {errors.programmes?.message && (
        <p className="text-sm text-destructive">{errors.programmes.message}</p>
      )}

      {!templatesLoading && (templates?.length ?? 0) === 0 && (
        <p className="text-sm text-destructive">
          No curriculum templates found — seed the board catalogue before assigning programmes.
        </p>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <ProgrammeRow
            key={field.id}
            index={index}
            templates={templates ?? []}
            templatesLoading={templatesLoading}
            onRemove={() => remove(index)}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() =>
          append({ code: "", name: "", board: "", medium: "", template_board_code: "" })
        }
      >
        <Plus className="size-4" />
        Add programme
      </Button>
    </section>
  );
}

interface ProgrammeRowProps {
  index: number;
  templates: SubjectTemplate[];
  templatesLoading: boolean;
  onRemove: () => void;
}

// Its own component so `useWatch` can read this row's `template_board_code`
// live — `fields[index]` from `useFieldArray` only reflects the value at
// mount/append time, not the current typed/selected value.
function ProgrammeRow({ index, templates, templatesLoading, onRemove }: ProgrammeRowProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<OnboardingConfig>();
  const templateBoardCode = useWatch({
    control,
    name: `programmes.${index}.template_board_code`,
  });
  const rowErrors = errors.programmes?.[index];

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <div className="space-y-2">
        <Label htmlFor={`programmes.${index}.code`}>Code</Label>
        <Input id={`programmes.${index}.code`} {...register(`programmes.${index}.code` as const)} />
        {rowErrors?.code && <p className="text-sm text-destructive">{rowErrors.code.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`programmes.${index}.name`}>Name</Label>
        <Input id={`programmes.${index}.name`} {...register(`programmes.${index}.name` as const)} />
        {rowErrors?.name && <p className="text-sm text-destructive">{rowErrors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`programmes.${index}.board`}>Board</Label>
        <Input
          id={`programmes.${index}.board`}
          {...register(`programmes.${index}.board` as const)}
        />
        {rowErrors?.board && <p className="text-sm text-destructive">{rowErrors.board.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`programmes.${index}.medium`}>Medium</Label>
        <Input
          id={`programmes.${index}.medium`}
          {...register(`programmes.${index}.medium` as const)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`programmes.${index}.template_board_code`}>Curriculum template</Label>
        <Select
          value={templateBoardCode || undefined}
          onValueChange={(value) =>
            setValue(`programmes.${index}.template_board_code`, value, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          disabled={templatesLoading}
        >
          <SelectTrigger id={`programmes.${index}.template_board_code`}>
            <SelectValue placeholder={templatesLoading ? "Loading…" : "Select a template"} />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.board_code} value={t.board_code}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rowErrors?.template_board_code && (
          <p className="text-sm text-destructive">{rowErrors.template_board_code.message}</p>
        )}
      </div>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
          Remove programme
        </Button>
      </div>
    </div>
  );
}
