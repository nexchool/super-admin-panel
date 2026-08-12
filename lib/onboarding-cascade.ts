import type { OnboardingClass, OnboardingExtraSubject } from "@/lib/schemas";

/**
 * A unit, programme or grade that has just been deleted from the config.
 *
 * Grades are identified by name and programmes/units by code, because that is
 * how `classes[]` and `extra_subjects[]` refer to them.
 */
export type RemovedEntity =
  | { kind: "grade"; name: string }
  | { kind: "programme"; code: string }
  | { kind: "unit"; code: string };

export interface ConfigReferences {
  classes: OnboardingClass[];
  extraSubjects: OnboardingExtraSubject[];
}

/**
 * Drop what referenced a just-removed unit, programme or grade.
 *
 * The classes grid draws one cell per (unit, programme, grade) that still
 * exists, so an entry whose parent is gone becomes invisible on screen while
 * remaining in form state — and is still submitted. The server then rejects
 * the whole config with "class references unknown grade '11'", naming a grade
 * the operator already deleted and can no longer see anywhere on the form.
 *
 * Removing the dependants along with their parent is what keeps the form
 * honest about what it is going to send.
 */
export function cascadeRemoval(
  removed: RemovedEntity,
  current: ConfigReferences
): ConfigReferences {
  const { classes, extraSubjects } = current;

  if (removed.kind === "grade") {
    return {
      classes: classes.filter((c) => c.grade !== removed.name),
      // An extra subject taught only in the grade being removed has nothing
      // left to be taught in, and the schema requires at least one grade.
      extraSubjects: extraSubjects
        .map((s) => ({ ...s, grades: s.grades.filter((g) => g !== removed.name) }))
        .filter((s) => s.grades.length > 0),
    };
  }

  if (removed.kind === "programme") {
    return {
      classes: classes.filter((c) => c.programme !== removed.code),
      extraSubjects: extraSubjects.filter((s) => s.programme !== removed.code),
    };
  }

  return {
    // Extra subjects are programme-scoped, not branch-scoped, so a removed
    // branch leaves them alone.
    classes: classes.filter((c) => c.unit !== removed.code),
    extraSubjects,
  };
}
