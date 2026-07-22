/**
 * Shared heading markup for onboarding form sections. Extracted so every
 * section renders the exact title/subtitle text `onboarding-form.tsx` already
 * defines (via `SECTION_STUBS`) without copy-pasting the same two lines of
 * JSX into six files.
 */
export interface SectionHeaderProps {
  title: string;
  subtitle: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </>
  );
}
