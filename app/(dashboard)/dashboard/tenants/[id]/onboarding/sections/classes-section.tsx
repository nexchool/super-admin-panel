"use client";

import { useState } from "react";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
import { X } from "lucide-react";

import type { OnboardingConfig } from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader, type SectionHeaderProps } from "./section-header";

// One `classes[]` entry is a `{unit, programme, grade, sections[]}` tuple, so
// the grid below is keyed by that same triple: for each unit x programme
// group we render one cell per grade. A cell's chips ARE the entry's
// `sections[]`; adding the first section appends a new `classes[]` entry,
// removing the last one deletes it. Cells are matched by (unit, programme,
// grade) value, never by array index, so the grid stays correct however the
// underlying `classes[]` array is ordered.
export function ClassesSection({ title, subtitle }: SectionHeaderProps) {
  const { control } = useFormContext<OnboardingConfig>();
  const { fields, append, update, remove } = useFieldArray({ control, name: "classes" });
  const units = useWatch({ control, name: "units" }) ?? [];
  const programmes = useWatch({ control, name: "programmes" }) ?? [];
  const grades = useWatch({ control, name: "grades" }) ?? [];

  const validUnits = units.filter((u) => u.code.trim() !== "");
  const validProgrammes = programmes.filter((p) => p.code.trim() !== "");
  const validGrades = [...grades]
    .filter((g) => g.name.trim() !== "")
    .sort((a, b) => a.sequence - b.sequence);

  if (validUnits.length === 0 || validProgrammes.length === 0 || validGrades.length === 0) {
    return (
      <section className="space-y-2">
        <SectionHeader title={title} subtitle={subtitle} />
        <p className="text-sm text-muted-foreground">
          Fill in branches, programmes, and grades first — classes are built from those.
        </p>
      </section>
    );
  }

  const findIndex = (unit: string, programme: string, grade: string) =>
    fields.findIndex((f) => f.unit === unit && f.programme === programme && f.grade === grade);

  // The placeholder reads "A, B…", so a comma-separated list is what an
  // operator naturally types. Taken literally that produced one section named
  // "A, B" and no complaint from anywhere, so split on commas and add each.
  const addSection = (unit: string, programme: string, grade: string, input: string) => {
    const labels = input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (labels.length === 0) return;

    const idx = findIndex(unit, programme, grade);
    if (idx === -1) {
      append({ unit, programme, grade, sections: [...new Set(labels)] });
      return;
    }

    const existing = fields[idx].sections;
    const merged = [...existing];
    for (const label of labels) {
      if (!merged.includes(label)) merged.push(label);
    }
    if (merged.length !== existing.length) {
      update(idx, { ...fields[idx], sections: merged });
    }
  };

  const removeSection = (unit: string, programme: string, grade: string, section: string) => {
    const idx = findIndex(unit, programme, grade);
    if (idx === -1) return;
    const remaining = fields[idx].sections.filter((s) => s !== section);
    if (remaining.length === 0) {
      remove(idx);
    } else {
      update(idx, { ...fields[idx], sections: remaining });
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader title={title} subtitle={subtitle} />

      {validUnits.map((unit) =>
        validProgrammes.map((programme) => (
          <div key={`${unit.code}-${programme.code}`} className="space-y-3">
            <h4 className="text-sm font-medium">
              {unit.name || unit.code} · {programme.name || programme.code}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {validGrades.map((grade) => {
                const idx = findIndex(unit.code, programme.code, grade.name);
                const sections = idx === -1 ? [] : fields[idx].sections;
                return (
                  <ClassCell
                    key={`${unit.code}-${programme.code}-${grade.name}`}
                    gradeLabel={grade.name}
                    sections={sections}
                    onAdd={(section) => addSection(unit.code, programme.code, grade.name, section)}
                    onRemove={(section) =>
                      removeSection(unit.code, programme.code, grade.name, section)
                    }
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

interface ClassCellProps {
  gradeLabel: string;
  sections: string[];
  onAdd: (section: string) => void;
  onRemove: (section: string) => void;
}

function ClassCell({ gradeLabel, sections, onAdd, onRemove }: ClassCellProps) {
  const [value, setValue] = useState("");

  const commit = () => {
    onAdd(value);
    setValue("");
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{gradeLabel}</p>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <Badge key={s} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
            {s}
            <button
              type="button"
              onClick={() => onRemove(s)}
              className="rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="size-3" />
              <span className="sr-only">Remove section {s}</span>
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Section (A, B…)"
          className="h-8 text-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={commit}>
          Add
        </Button>
      </div>
    </div>
  );
}
