"use client";

import { useEffect, useState } from "react";
import { Ban, Plus, Receipt } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorMessage } from "@/lib/api";
import { useRecordPayment, useTenantPayments, useVoidPayment } from "@/hooks/useApi";
import type { PaymentMethod, SubscriptionPayment, TenantDetail } from "@/types";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const methodLabel = (m: PaymentMethod) => METHODS.find((x) => x.value === m)?.label ?? m;
const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtMoney = (n: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);

/** One year on from a date, the way a yearly subscription renews. */
function plusOneYear(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

type PaymentForm = {
  amount: string;
  paidOn: string;
  reference: string;
  coversFrom: string;
  coversTo: string;
  note: string;
  nextDueOn: string;
};

/**
 * Every payment the school made, as the operator wrote it down (ADR-023).
 *
 * A payment is never edited or deleted. A wrong one is voided with a reason
 * and stays on the list, struck through, so the school sees the same trail.
 * Recording a payment with a next due date is how a renewal is done: the
 * term moves on and a suspended school comes back.
 */
export function PaymentsSection({ tenant }: { tenant: TenantDetail }) {
  const { data: payments, isLoading } = useTenantPayments(tenant.id);
  const record = useRecordPayment(tenant.id);
  const voidPayment = useVoidPayment(tenant.id);
  const [open, setOpen] = useState(false);
  const [toVoid, setToVoid] = useState<SubscriptionPayment | null>(null);
  const [voidReason, setVoidReason] = useState("");
  // The method lives outside react-hook-form: Radix Select is controlled, and
  // watching a form field for it trips the react-hooks lint on this project.
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");

  const form = useForm<PaymentForm>({
    defaultValues: {
      amount: "", paidOn: "", reference: "",
      coversFrom: "", coversTo: "", note: "", nextDueOn: "",
    },
  });

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().slice(0, 10);
      // Prefill the renewal the way a yearly term usually goes: the current
      // due date rolled on a year, or a year from today when there is none.
      const base = tenant.subscriptionDueOn ?? today;
      form.reset({
        amount: "", paidOn: today, reference: "",
        coversFrom: tenant.subscriptionDueOn ?? "", coversTo: "", note: "",
        nextDueOn: plusOneYear(base),
      });
    }
  }, [open, tenant.subscriptionDueOn, form]);

  const submit = async (values: PaymentForm) => {
    const amount = Number(values.amount);
    if (!(amount > 0)) {
      form.setError("amount", { message: "Enter an amount greater than zero" });
      return;
    }
    if (!values.paidOn) {
      form.setError("paidOn", { message: "When was it paid?" });
      return;
    }
    try {
      await record.mutateAsync({
        amount, paidOn: values.paidOn, method, reference: values.reference,
        coversFrom: values.coversFrom, coversTo: values.coversTo, note: values.note,
        nextDueOn: values.nextDueOn,
      });
      toast.success(values.nextDueOn ? "Payment recorded and term renewed" : "Payment recorded");
      setOpen(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const confirmVoid = async () => {
    if (!toVoid) return;
    if (!voidReason.trim()) {
      toast.error("Give a reason; it stays on the record.");
      return;
    }
    try {
      await voidPayment.mutateAsync({ paymentId: toVoid.id, reason: voidReason.trim() });
      toast.success("Payment voided");
      setToVoid(null);
      setVoidReason("");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <Card className="mt-6 rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          Payments
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setMethod("bank_transfer");
            setOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Record payment
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded bg-muted" />
        ) : !payments || payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payments on record yet. Record the first one when the school pays.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paid on</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} className={p.voidedAt ? "text-muted-foreground" : undefined}>
                  <TableCell className={p.voidedAt ? "line-through" : undefined}>{fmtDate(p.paidOn)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${p.voidedAt ? "line-through" : "font-medium"}`}>
                    {fmtMoney(p.amount, p.currency)}
                  </TableCell>
                  <TableCell>{methodLabel(p.method)}</TableCell>
                  <TableCell>{p.reference ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {p.coversFrom || p.coversTo ? `${fmtDate(p.coversFrom)} → ${fmtDate(p.coversTo)}` : "—"}
                    {p.note ? <span className="block text-muted-foreground">{p.note}</span> : null}
                  </TableCell>
                  <TableCell className="text-xs">{p.recordedBy ?? "—"}</TableCell>
                  <TableCell>
                    {p.voidedAt ? (
                      <Badge variant="outline" title={p.voidReason ?? undefined}>Voided</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Void payment"
                        onClick={() => setToVoid(p)}
                      >
                        <Ban className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" min="0.01" step="0.01" {...form.register("amount")} />
                {form.formState.errors.amount && (
                  <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Paid on</Label>
                <Input type="date" {...form.register("paidOn")} />
                {form.formState.errors.paidOn && (
                  <p className="text-sm text-destructive">{form.formState.errors.paidOn.message}</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input placeholder="UTR, cheque no., UPI ref" {...form.register("reference")} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Covers from</Label>
                <Input type="date" {...form.register("coversFrom")} />
              </div>
              <div className="space-y-2">
                <Label>Covers to</Label>
                <Input type="date" {...form.register("coversTo")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input placeholder="Optional" {...form.register("note")} />
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Next payment due on</Label>
              <Input type="date" {...form.register("nextDueOn")} />
              <p className="text-xs text-muted-foreground">
                Filled in as one year on. Saving with a date renews the term and reactivates a
                suspended school. Clear it for a part payment that changes nothing.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={record.isPending}>
                {record.isPending ? "Saving…" : "Record payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toVoid} onOpenChange={(o) => { if (!o) { setToVoid(null); setVoidReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void this payment?</DialogTitle>
          </DialogHeader>
          {toVoid ? (
            <p className="text-sm text-muted-foreground">
              {fmtMoney(toVoid.amount, toVoid.currency)} paid on {fmtDate(toVoid.paidOn)} stays on the
              record, struck through with your reason. The term is not changed.
            </p>
          ) : null}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Entered against the wrong school" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setToVoid(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={confirmVoid} disabled={voidPayment.isPending}>
              Void payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
