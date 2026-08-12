"use client";

import { useFormContext } from "react-hook-form";

import { cascadeRemoval, type RemovedEntity } from "@/lib/onboarding-cascade";
import type { OnboardingConfig } from "@/lib/schemas";

/**
 * Returns a function to call straight after removing a unit, programme or
 * grade, so nothing is left pointing at it. See `cascadeRemoval` for why.
 *
 * The removed entity is passed in rather than derived from the form, because
 * the caller knows exactly what it just deleted and this avoids depending on
 * whether `useFieldArray`'s removal has settled into `getValues()` yet.
 */
export function useRemovalCascade() {
  const { getValues, setValue } = useFormContext<OnboardingConfig>();

  return (removed: RemovedEntity) => {
    const current = {
      classes: getValues("classes") ?? [],
      extraSubjects: getValues("extra_subjects") ?? [],
    };
    const next = cascadeRemoval(removed, current);

    // Only write when something actually went, so removing a grade nothing
    // depends on does not dirty the form or wake the autosave.
    if (JSON.stringify(next.classes) !== JSON.stringify(current.classes)) {
      setValue("classes", next.classes, { shouldDirty: true });
    }
    if (JSON.stringify(next.extraSubjects) !== JSON.stringify(current.extraSubjects)) {
      setValue("extra_subjects", next.extraSubjects, { shouldDirty: true });
    }
  };
}
