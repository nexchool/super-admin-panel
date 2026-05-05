"use client";

import { useEffect } from "react";
import { usePlatformSettings, useInvalidateSettings } from "@/hooks/useApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";

const SETTING_KEYS = [
  "platform_name",
  "maintenance_mode",
  "session_timeout_minutes",
  "max_login_attempts",
  "email_from_name",
  "support_email",
] as const;

export default function SettingsPage() {
  const { data: settings, isLoading, error } = usePlatformSettings();
  const invalidateSettings = useInvalidateSettings();
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings && typeof settings === "object") {
      const next: Record<string, string> = {};
      SETTING_KEYS.forEach((key) => {
        const v = settings[key];
        next[key] = v != null ? String(v) : "";
      });
      setFormValues(next);
    }
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      SETTING_KEYS.forEach((key) => {
        const v = formValues[key];
        if (key === "maintenance_mode") {
          payload[key] = v === "true" ? "true" : "false";
        } else if (v === "" || v == null) {
          payload[key] = null;
        } else {
          payload[key] = v;
        }
      });
      await api.patch("/api/platform/settings", payload);
      toast.success("Settings saved");
      await invalidateSettings();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">Settings</h1>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Failed to load settings"}
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Settings</h1>

      <form onSubmit={handleSubmit}>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Platform settings</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure platform-wide options. These affect all tenants and the super admin panel.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Platform name</Label>
              <Input
                id="platform_name"
                value={formValues.platform_name ?? ""}
                onChange={(e) => handleChange("platform_name", e.target.value)}
                placeholder="e.g. School ERP"
              />
              <p className="text-xs text-muted-foreground">Display name for the platform (e.g. in emails or branding).</p>
            </div>

            <div className="space-y-2">
              <Label>Maintenance mode</Label>
              <Select
                value={formValues.maintenance_mode ?? "false"}
                onValueChange={(v) => handleChange("maintenance_mode", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Off</SelectItem>
                  <SelectItem value="true">On</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">When on, tenant logins may be disabled (implement in backend if needed).</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_timeout_minutes">Session timeout (minutes)</Label>
              <Input
                id="session_timeout_minutes"
                type="number"
                min="5"
                max="10080"
                value={formValues.session_timeout_minutes ?? ""}
                onChange={(e) => handleChange("session_timeout_minutes", e.target.value)}
                placeholder="e.g. 60"
              />
              <p className="text-xs text-muted-foreground">How long user sessions stay valid before requiring re-login.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_login_attempts">Max login attempts</Label>
              <Input
                id="max_login_attempts"
                type="number"
                min="3"
                max="20"
                value={formValues.max_login_attempts ?? ""}
                onChange={(e) => handleChange("max_login_attempts", e.target.value)}
                placeholder="e.g. 5"
              />
              <p className="text-xs text-muted-foreground">Lock tenant (school/mobile app) accounts after this many failed login attempts. Does not apply to Super Admin panel login.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_from_name">Email &quot;From&quot; name</Label>
              <Input
                id="email_from_name"
                value={formValues.email_from_name ?? ""}
                onChange={(e) => handleChange("email_from_name", e.target.value)}
                placeholder="e.g. School ERP"
              />
              <p className="text-xs text-muted-foreground">Name shown as sender in system emails.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="support_email">Support email</Label>
              <Input
                id="support_email"
                type="email"
                value={formValues.support_email ?? ""}
                onChange={(e) => handleChange("support_email", e.target.value)}
                placeholder="support@example.com"
              />
              <p className="text-xs text-muted-foreground">Contact email for platform support (e.g. in footers or error pages).</p>
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
