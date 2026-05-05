"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTenantSchema, type CreateTenantFormValues } from "@/lib/schemas";
import { useFeatureCatalog } from "@/hooks/useApi";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface CreateTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateTenantModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateTenantModalProps) {
  const { data: catalog } = useFeatureCatalog();
  const optionalFeatures = useMemo(
    () => (catalog ?? []).filter((f) => f.toggleable),
    [catalog]
  );

  const defaultFlags = useMemo(() => {
    const f: Record<string, boolean> = {};
    optionalFeatures.forEach((feat) => {
      f[feat.key] = true;
    });
    return f;
  }, [optionalFeatures]);

  const form = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      contactEmail: "",
      phone: "",
      address: "",
      adminName: "",
      adminEmail: "",
      pricePerStudentPerYear: "",
      discountPercentage: "",
      discountStartDate: "",
      discountEndDate: "",
      featureFlags: {},
    },
  });

  useEffect(() => {
    if (open && optionalFeatures.length > 0) {
      const current = form.getValues("featureFlags") ?? {};
      if (Object.keys(current).length === 0) {
        form.setValue("featureFlags", defaultFlags);
      }
    }
  }, [open, optionalFeatures.length, defaultFlags, form]);

  const onSubmit = async (values: CreateTenantFormValues) => {
    try {
      const payload: Record<string, unknown> = {
        name: values.name,
        subdomain: values.subdomain,
        contact_email: values.contactEmail,
        phone: values.phone || undefined,
        address: values.address || undefined,
        admin_name: values.adminName,
        admin_email: values.adminEmail,
      };
      if (values.pricePerStudentPerYear !== "" && values.pricePerStudentPerYear != null) {
        payload.price_per_student_per_year = Number(values.pricePerStudentPerYear);
      }
      if (values.discountPercentage !== "" && values.discountPercentage != null) {
        payload.discount_percentage = Number(values.discountPercentage);
      }
      if (values.discountStartDate) payload.discount_start_date = values.discountStartDate;
      if (values.discountEndDate) payload.discount_end_date = values.discountEndDate;
      if (values.featureFlags && Object.keys(values.featureFlags).length > 0) {
        payload.feature_flags = values.featureFlags;
      }

      await api.post("/api/platform/tenants", payload);
      toast.success("Tenant created");
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      const msg = getErrorMessage(e);
      form.setError("root", { message: msg });
      toast.error(msg);
    }
  };

  const featureFlags = form.watch("featureFlags") ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create tenant</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">School details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <Input id="subdomain" {...form.register("subdomain")} />
                {form.formState.errors.subdomain && (
                  <p className="text-sm text-destructive">{form.formState.errors.subdomain.message}</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input id="contactEmail" type="email" {...form.register("contactEmail")} />
                {form.formState.errors.contactEmail && (
                  <p className="text-sm text-destructive">{form.formState.errors.contactEmail.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...form.register("phone")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...form.register("address")} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pricing</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pricePerStudentPerYear">Price per student / year (₹)</Label>
                <Input
                  id="pricePerStudentPerYear"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("pricePerStudentPerYear")}
                  placeholder="e.g. 1200"
                />
                {form.formState.errors.pricePerStudentPerYear && (
                  <p className="text-sm text-destructive">{form.formState.errors.pricePerStudentPerYear.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountPercentage">Discount %</Label>
                <Input
                  id="discountPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  {...form.register("discountPercentage")}
                  placeholder="0–100"
                />
                {form.formState.errors.discountPercentage && (
                  <p className="text-sm text-destructive">{form.formState.errors.discountPercentage.message}</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discountStartDate">Discount start</Label>
                <Input id="discountStartDate" type="date" {...form.register("discountStartDate")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountEndDate">Discount end</Label>
                <Input id="discountEndDate" type="date" {...form.register("discountEndDate")} />
              </div>
            </div>
          </section>

          {optionalFeatures.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Features</h3>
              <p className="text-xs text-muted-foreground">All toggleable features default to enabled. Disable any that this school should not use.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {optionalFeatures.map((feat) => {
                  const checked = featureFlags[feat.key] !== false;
                  return (
                    <label key={feat.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <span className="text-sm font-medium">{feat.label}</span>
                      <Switch
                        checked={checked}
                        onCheckedChange={(v) =>
                          form.setValue("featureFlags", {
                            ...(form.getValues("featureFlags") ?? {}),
                            [feat.key]: v,
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">First school admin</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adminName">Admin name</Label>
                <Input id="adminName" {...form.register("adminName")} />
                {form.formState.errors.adminName && (
                  <p className="text-sm text-destructive">{form.formState.errors.adminName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin email</Label>
                <Input id="adminEmail" type="email" {...form.register("adminEmail")} />
                {form.formState.errors.adminEmail && (
                  <p className="text-sm text-destructive">{form.formState.errors.adminEmail.message}</p>
                )}
              </div>
            </div>
          </section>

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating…" : "Create tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
