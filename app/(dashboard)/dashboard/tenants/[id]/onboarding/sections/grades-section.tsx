"use client";

import { useState } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, X } from "lucide-react";

import type { OnboardingConfig } from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader, type SectionHeaderProps } from "./section-header";
import { useRemovalCascade } from "./use-removal-cascade";

export function GradesSection({ title, subtitle }: SectionHeaderProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<OnboardingConfig>();
  const { fields, append, remove } = useFieldArray({ control, name: "grades" });
  const cascade = useRemovalCascade();

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [manualName, setManualName] = useState("");

  const existingNames = new Set(fields.map((f) => f.name));

  const handleAddRange = () => {
    const from = Number(rangeFrom);
    const to = Number(rangeTo);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) return;
    for (let n = from; n <= to; n++) {
      if (!existingNames.has(String(n))) {
        append({ name: String(n), sequence: n });
      }
    }
    setRangeFrom("");
    setRangeTo("");
  };

  const handleAddManual = () => {
    const name = manualName.trim();
    if (!name || existingNames.has(name)) return;
    // Non-numeric grades (Nursery/LKG/UKG) get appended after whatever is
    // already there — always valid (schema requires sequence >= 1) and keeps
    // insertion order stable. Add pre-primary grades before running the
    // numeric range if they should sort ahead of Grade 1.
    const maxSequence = fields.reduce((max, f) => Math.max(max, f.sequence), 0);
    append({ name, sequence: maxSequence + 1 });
    setManualName("");
  };

  // A grade's name is fixed once appended (there is no inline edit), so the
  // append-time `fields[index].name` is still the right key to prune by.
  const handleRemove = (index: number, name: string) => {
    remove(index);
    cascade({ kind: "grade", name });
  };

  const sortedGrades = fields
    .map((field, index) => ({ field, index }))
    .sort((a, b) => a.field.sequence - b.field.sequence);

  return (
    <section className="space-y-4">
      <SectionHeader title={title} subtitle={subtitle} />

      {errors.grades?.message && (
        <p className="text-sm text-destructive">{errors.grades.message}</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="grade-range-from">From</Label>
          <Input
            id="grade-range-from"
            type="number"
            min="1"
            className="w-24"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grade-range-to">To</Label>
          <Input
            id="grade-range-to"
            type="number"
            min="1"
            className="w-24"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={handleAddRange}
        >
          <Plus className="size-4" />
          Add range
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="grade-manual-name">Grade name</Label>
          <Input
            id="grade-manual-name"
            placeholder="Nursery, LKG, UKG…"
            className="w-40"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={handleAddManual}
        >
          <Plus className="size-4" />
          Add grade
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {sortedGrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No grades yet.</p>
        ) : (
          sortedGrades.map(({ field, index }) => (
            <Badge key={field.id} variant="secondary" className="gap-1 py-1 pl-3 pr-1.5">
              {field.name}
              <button
                type="button"
                onClick={() => handleRemove(index, field.name)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="size-3" />
                <span className="sr-only">Remove grade {field.name}</span>
              </button>
            </Badge>
          ))
        )}
      </div>
    </section>
  );
}
