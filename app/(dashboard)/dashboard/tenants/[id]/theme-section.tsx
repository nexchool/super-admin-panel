"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, LockOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { ThemeSeeds } from "@/types";

/** The colours an operator sets. Everything else is derived server-side. */
const SEED_FIELDS: { key: keyof ThemeSeeds; label: string; hint: string }[] = [
  { key: "primary", label: "Primary", hint: "Buttons, links, the active tab" },
  { key: "secondary", label: "Secondary", hint: "Supporting accents" },
  { key: "tertiary", label: "Tertiary", hint: "Highlights and badges" },
];

/** The tokens worth showing back — the ones a bad choice shows up in first. */
const PREVIEW_TOKENS: { token: string; on: string; label: string }[] = [
  { token: "primary", on: "onPrimary", label: "Primary" },
  { token: "primaryContainer", on: "onPrimaryContainer", label: "Primary container" },
  { token: "secondary", on: "onSecondary", label: "Secondary" },
  { token: "secondaryContainer", on: "onSecondaryContainer", label: "Secondary container" },
  { token: "tertiary", on: "onTertiary", label: "Tertiary" },
  { token: "surface", on: "onSurface", label: "Surface" },
  { token: "surfaceContainer", on: "onSurfaceVariant", label: "Surface container" },
];

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type Props = {
  tenantId: string;
  seeds: ThemeSeeds | null;
  defaultSeeds: ThemeSeeds;
  onSaved: () => void;
};

/**
 * The tenant's mobile app colours.
 *
 * Locked on open, and edited only after an explicit unlock. A tenant detail
 * page is the kind of screen that sits open on a second monitor for an hour,
 * and a stray click on a colour swatch would otherwise re-brand a school's
 * app without anyone noticing it happened.
 */
export function ThemeSection({ tenantId, seeds, defaultSeeds, onSaved }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [draft, setDraft] = useState<ThemeSeeds>(seeds ?? defaultSeeds);
  const [preview, setPreview] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(seeds ?? defaultSeeds);
  }, [seeds, defaultSeeds]);

  const invalid = useMemo(
    () =>
      SEED_FIELDS.filter(({ key }) => {
        const value = draft[key];
        return key === "primary" ? !value || !HEX.test(value) : !!value && !HEX.test(value);
      }).map((f) => f.key),
    [draft]
  );

  // The preview comes from the server so it cannot disagree with the app.
  // Debounced because a colour input fires continuously while it is dragged.
  useEffect(() => {
    if (invalid.length > 0) return;
    const handle = setTimeout(() => {
      void api
        .post<{ data?: { colors?: Record<string, string> } }>("/api/platform/theme/preview", {
          seeds: draft,
        })
        .then((res) => setPreview(res?.data?.colors ?? null))
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(handle);
  }, [draft, invalid.length]);

  const save = async (next: ThemeSeeds | null) => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/platform/tenants/${tenantId}/theme`, { seeds: next });
      setUnlocked(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the theme");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6 rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Mobile app theme</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {seeds
              ? "This school's own colours."
              : "Using the default palette. Nothing is saved until you set a colour."}
          </p>
        </div>
        <Button
          variant={unlocked ? "secondary" : "outline"}
          size="sm"
          onClick={() => {
            setDraft(seeds ?? defaultSeeds);
            setUnlocked((open) => !open);
          }}
        >
          {unlocked ? <LockOpen className="mr-2 size-4" /> : <Lock className="mr-2 size-4" />}
          {unlocked ? "Locked when done" : "Unlock to edit"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {SEED_FIELDS.map(({ key, label, hint }) => {
            const value = draft[key] ?? "";
            const bad = invalid.includes(key);
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`seed-${key}`}>
                  {label}
                  {key === "primary" ? " *" : ""}
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`${label} colour picker`}
                    disabled={!unlocked}
                    value={HEX.test(value) ? value : "#000000"}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <Input
                    id={`seed-${key}`}
                    disabled={!unlocked}
                    value={value}
                    placeholder={defaultSeeds[key] ?? "#000000"}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    className={bad ? "border-destructive" : undefined}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {bad ? "Enter a hex colour such as #4648d4" : hint}
                </p>
              </div>
            );
          })}
        </div>

        {preview ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              What the app will look like
              <span className="ml-2 font-normal text-muted-foreground">
                derived from the colours above
              </span>
            </p>
            <div className="grid gap-2 sm:grid-cols-4">
              {PREVIEW_TOKENS.map(({ token, on, label }) => (
                <div
                  key={token}
                  className="rounded-lg border px-3 py-4 text-center text-xs"
                  style={{ backgroundColor: preview[token], color: preview[on] }}
                >
                  <div className="font-medium">{label}</div>
                  <div className="mt-1 font-mono opacity-80">{preview[token]}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {unlocked ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void save(draft)} disabled={saving || invalid.length > 0}>
              {saving ? "Saving…" : "Save theme"}
            </Button>
            <Button variant="outline" onClick={() => setDraft(defaultSeeds)} disabled={saving}>
              <RotateCcw className="mr-2 size-4" />
              Reset to default
            </Button>
            {seeds ? (
              <Button variant="ghost" onClick={() => void save(null)} disabled={saving}>
                Remove theme
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Schools see the new colours next time they open the app.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
