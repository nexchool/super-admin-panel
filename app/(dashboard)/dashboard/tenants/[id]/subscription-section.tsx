"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, getErrorMessage } from "@/lib/api";
import type { TenantDetail, TermStanding } from "@/types";

const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STANDING: Record<TermStanding, { label: string; variant: "success" | "secondary" | "destructive" | "outline" }> = {
  no_term: { label: "No term set", variant: "outline" },
  current: { label: "Current", variant: "success" },
  payment_due: { label: "Payment due", variant: "secondary" },
  grace_expired: { label: "Grace expired", variant: "destructive" },
};

type TermForm = {
  startsOn: string;
  dueOn: string;
  graceDays: string;
};

/**
 * The school's subscription term: when it began, when payment is due, and
 * how long the school keeps working after that (ADR-023). Recording a
 * payment with a next due date is the usual way the term moves on; this card
 * is for setting it up and for corrections.
 */
export function SubscriptionSection({
  tenant,
  onChanged,
}: {
  tenant: TenantDetail;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [savingSwitch, setSavingSwitch] = useState(false);
  const form = useForm<TermForm>({
    defaultValues: { startsOn: "", dueOn: "", graceDays: "7" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        startsOn: tenant.subscriptionStartsOn ?? "",
        dueOn: tenant.subscriptionDueOn ?? "",
        graceDays: String(tenant.graceDays ?? 7),
      });
    }
  }, [open, tenant, form]);

  const standing = STANDING[tenant.term.standing];

  const save = async (values: TermForm) => {
    const grace = Number(values.graceDays);
    if (!Number.isInteger(grace) || grace < 0) {
      form.setError("graceDays", { message: "Whole number of days, zero or more" });
      return;
    }
    if (values.startsOn && values.dueOn && values.startsOn > values.dueOn) {
      form.setError("dueOn", { message: "Due date must be on or after the start date" });
      return;
    }
    try {
      await api.patch(`/api/platform/tenants/${tenant.id}/subscription`, {
        subscription_starts_on: values.startsOn,
        subscription_due_on: values.dueOn,
        grace_days: grace,
      });
      toast.success("Subscription term updated");
      setOpen(false);
      await onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const toggleAutoSuspend = async (enabled: boolean) => {
    setSavingSwitch(true);
    try {
      await api.patch(`/api/platform/tenants/${tenant.id}/subscription`, {
        auto_suspend_after_grace: enabled,
      });
      toast.success(enabled ? "Will suspend automatically after grace" : "Suspension left to you");
      await onChanged();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingSwitch(false);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          Subscription term
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="mr-2 size-4" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={standing.variant}>{standing.label}</Badge>
          {tenant.term.standing === "current" && tenant.term.daysUntilDue != null ? (
            <span className="text-sm text-muted-foreground">
              {tenant.term.daysUntilDue === 0
                ? "Due today"
                : `${tenant.term.daysUntilDue} day${tenant.term.daysUntilDue === 1 ? "" : "s"} to the due date`}
            </span>
          ) : null}
          {tenant.term.standing === "payment_due" ? (
            <span className="text-sm text-muted-foreground">
              Keeps working until {fmtDate(tenant.term.graceEndsOn)}
            </span>
          ) : null}
          {tenant.term.standing === "grace_expired" ? (
            <span className="text-sm text-destructive">
              Grace ended {fmtDate(tenant.term.graceEndsOn)} — writes are blocked
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Started on</p>
            <p className="font-medium">{fmtDate(tenant.subscriptionStartsOn)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Payment due on</p>
            <p className="font-medium">{fmtDate(tenant.subscriptionDueOn)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Grace period</p>
            <p className="font-medium">{tenant.graceDays} day{tenant.graceDays === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Suspend automatically after grace</p>
            <p className="text-xs text-muted-foreground">
              Off means the school stays active past grace until you suspend it yourself. Writes
              are blocked either way once grace ends.
            </p>
          </div>
          <Switch
            checked={tenant.autoSuspendAfterGrace}
            disabled={savingSwitch}
            onCheckedChange={toggleAutoSuspend}
            aria-label="Suspend automatically after grace"
          />
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit subscription term</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(save)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Started on</Label>
                <Input type="date" {...form.register("startsOn")} />
              </div>
              <div className="space-y-2">
                <Label>Payment due on</Label>
                <Input type="date" {...form.register("dueOn")} />
                {form.formState.errors.dueOn && (
                  <p className="text-sm text-destructive">{form.formState.errors.dueOn.message}</p>
                )}
                <p className="text-xs text-muted-foreground">Leave blank for no term.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Grace period (days after the due date)</Label>
              <Input type="number" min="0" step="1" {...form.register("graceDays")} />
              {form.formState.errors.graceDays && (
                <p className="text-sm text-destructive">{form.formState.errors.graceDays.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
