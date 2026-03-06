"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useTenant,
  usePlans,
  useTenantAdmins,
  useTenantNotificationSettings,
  useInvalidateTenants,
  useInvalidateDashboard,
  useInvalidateTenant,
  useInvalidateTenantAdmins,
  useInvalidateTenantNotificationSettings,
} from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  changePlanSchema,
  editTenantSchema,
  addTenantAdminSchema,
  type ChangePlanFormValues,
  type EditTenantFormValues,
  type AddTenantAdminFormValues,
} from "@/lib/schemas";
import { api } from "@/lib/api";
import { ArrowLeft, Pause, Play, KeyRound, Trash2, CreditCard, Pencil, UserPlus, Mail, MessageSquare, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

export function TenantDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data: tenant, isLoading, error } = useTenant(id);
  const { data: plans } = usePlans();
  const { data: admins, isLoading: adminsLoading } = useTenantAdmins(id);
  const { data: notificationSettings, isLoading: notificationSettingsLoading } = useTenantNotificationSettings(id);
  const invalidateTenants = useInvalidateTenants();
  const invalidateDashboard = useInvalidateDashboard();
  const invalidateTenant = useInvalidateTenant(id);
  const invalidateTenantAdmins = useInvalidateTenantAdmins(id);
  const invalidateNotificationSettings = useInvalidateTenantNotificationSettings(id);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [editTenantOpen, setEditTenantOpen] = useState(false);
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const changePlanForm = useForm<ChangePlanFormValues>({
    resolver: zodResolver(changePlanSchema),
    defaultValues: { planId: tenant?.planId ?? "" },
  });

  const editTenantForm = useForm<EditTenantFormValues>({
    resolver: zodResolver(editTenantSchema),
    defaultValues: {
      name: tenant?.name ?? "",
      contactEmail: tenant?.contactEmail ?? "",
      phone: tenant?.phone ?? "",
      address: tenant?.address ?? "",
    },
  });

  const addAdminForm = useForm<AddTenantAdminFormValues>({
    resolver: zodResolver(addTenantAdminSchema),
    defaultValues: { email: "", name: "" },
  });


  const handleChangePlan = async (values: ChangePlanFormValues) => {
    try {
      await api.patch(`/api/platform/tenants/${id}/change-plan`, { plan_id: values.planId });
      changePlanForm.reset({ planId: values.planId });
      setChangePlanOpen(false);
      await invalidateTenant();
      await invalidateTenants();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSuspendActivate = async () => {
    if (!tenant) return;
    try {
      const path =
        tenant.status === "active"
          ? `/api/platform/tenants/${id}/suspend`
          : `/api/platform/tenants/${id}/activate`;
      await api.patch(path);
      await invalidateTenant();
      await invalidateTenants();
      await invalidateDashboard();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetAdmin = async () => {
    try {
      await api.post(`/api/platform/tenants/${id}/reset-admin`);
      await invalidateTenant();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/platform/tenants/${id}`);
      setDeleteConfirmOpen(false);
      await invalidateTenants();
      await invalidateDashboard();
      router.push("/dashboard/tenants");
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditTenant = async (values: EditTenantFormValues) => {
    try {
      await api.patch(`/api/platform/tenants/${id}`, {
        name: values.name,
        contact_email: values.contactEmail,
        phone: values.phone || null,
        address: values.address || null,
      });
      setEditTenantOpen(false);
      await invalidateTenant();
      await invalidateTenants();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddAdmin = async (values: AddTenantAdminFormValues) => {
    try {
      await api.post(`/api/platform/tenants/${id}/admins`, {
        email: values.email,
        name: values.name,
      });
      setAddAdminOpen(false);
      addAdminForm.reset({ email: "", name: "" });
      await invalidateTenantAdmins();
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-8">
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Tenant not found"}
        </p>
        <Button variant="link" asChild className="mt-4">
          <Link href="/dashboard/tenants">Back to tenants</Link>
        </Button>
      </div>
    );
  }

  const createdDate = tenant.createdAt
    ? new Date(tenant.createdAt).toLocaleDateString()
    : "—";

  const plan = plans?.find((p) => p.id === tenant.planId);
  const notificationsEnabled = plan?.features?.notifications !== false;

  const emailEnabled = notificationSettings?.email_enabled ?? false;
  const smsEnabled = notificationSettings?.sms_enabled ?? false;
  const inAppEnabled = notificationSettings?.in_app_enabled ?? false;

  const handleChannelToggle = async (
    payload: { email_enabled: boolean; sms_enabled: boolean; in_app_enabled: boolean }
  ) => {
    try {
      await api.patch(`/api/platform/tenants/${id}/notification-settings`, payload);
      await invalidateNotificationSettings();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/tenants">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Basic info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Subdomain</p>
              <p className="font-medium">{tenant.subdomain}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="font-medium">{tenant.plan}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={
                  tenant.status === "active" ? "success" : "destructive"
                }
              >
                {tenant.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{createdDate}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Contact &amp; counts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenant.contactEmail && (
              <div>
                <p className="text-sm text-muted-foreground">Contact Email</p>
                <p className="font-medium">{tenant.contactEmail}</p>
              </div>
            )}
            {tenant.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{tenant.phone}</p>
              </div>
            )}
            {tenant.address && (
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{tenant.address}</p>
              </div>
            )}
            <div className="flex gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Students</p>
                <p className="font-medium">{tenant.studentsCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Teachers</p>
                <p className="font-medium">{tenant.teachersCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>School admins</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAddAdminOpen(true)}>
            <UserPlus className="mr-2 size-4" />
            Add admin
          </Button>
        </CardHeader>
        <CardContent>
          {adminsLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !admins?.length ? (
            <p className="text-sm text-muted-foreground">No school admins yet. Add one to allow login for this tenant.</p>
          ) : (
            <ul className="space-y-2">
              {admins.map((admin) => (
                <li key={admin.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="font-medium">{admin.name || admin.email}</p>
                    <p className="text-sm text-muted-foreground">{admin.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!notificationsEnabled ? (
        <Card className="mt-6 rounded-xl">
          <CardContent className="flex items-center gap-3 pt-6">
            <Badge variant="warning">Notifications disabled in current plan</Badge>
            <p className="text-sm text-muted-foreground">
              Enable the Notifications feature in this tenant&apos;s plan to configure notification settings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Notification settings</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/notification-templates?tenant_id=${id}`}>
                Manage templates
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {notificationSettingsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Email enabled</span>
                  </div>
                  <Switch
                    checked={emailEnabled}
                    onCheckedChange={(checked) =>
                      handleChannelToggle({
                        email_enabled: checked,
                        sms_enabled: smsEnabled,
                        in_app_enabled: inAppEnabled,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">SMS enabled</span>
                  </div>
                  <Switch
                    checked={smsEnabled}
                    onCheckedChange={(checked) =>
                      handleChannelToggle({
                        email_enabled: emailEnabled,
                        sms_enabled: checked,
                        in_app_enabled: inAppEnabled,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">In-App enabled</span>
                  </div>
                  <Switch
                    checked={inAppEnabled}
                    onCheckedChange={(checked) =>
                      handleChannelToggle({
                        email_enabled: emailEnabled,
                        sms_enabled: smsEnabled,
                        in_app_enabled: checked,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 rounded-xl">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              editTenantForm.reset({
                name: tenant.name,
                contactEmail: tenant.contactEmail ?? "",
                phone: tenant.phone ?? "",
                address: tenant.address ?? "",
              });
              setEditTenantOpen(true);
            }}
          >
            <Pencil className="mr-2 size-4" />
            Edit tenant
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              changePlanForm.setValue("planId", tenant.planId);
              setChangePlanOpen(true);
            }}
          >
            <CreditCard className="mr-2 size-4" />
            Change Plan
          </Button>
          <Button variant="outline" onClick={handleSuspendActivate}>
            {tenant.status === "active" ? (
              <>
                <Pause className="mr-2 size-4" />
                Suspend
              </>
            ) : (
              <>
                <Play className="mr-2 size-4" />
                Activate
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleResetAdmin}>
            <KeyRound className="mr-2 size-4" />
            Reset Admin
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete (soft)
          </Button>
        </CardContent>
      </Card>

      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={changePlanForm.handleSubmit(handleChangePlan)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Select
                value={changePlanForm.watch("planId")}
                onValueChange={(v) => changePlanForm.setValue("planId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(plans) ? plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  )) : null}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChangePlanOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Update plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editTenantOpen} onOpenChange={setEditTenantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={editTenantForm.handleSubmit(handleEditTenant)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...editTenantForm.register("name")} />
              {editTenantForm.formState.errors.name && (
                <p className="text-sm text-destructive">{editTenantForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Contact email</Label>
              <Input type="email" {...editTenantForm.register("contactEmail")} />
              {editTenantForm.formState.errors.contactEmail && (
                <p className="text-sm text-destructive">{editTenantForm.formState.errors.contactEmail.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input {...editTenantForm.register("phone")} />
            </div>
            <div className="space-y-2">
              <Label>Address (optional)</Label>
              <Input {...editTenantForm.register("address")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTenantOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addAdminOpen} onOpenChange={setAddAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add school admin</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Create an additional admin account for this tenant. They will receive login credentials by email.
          </p>
          <form onSubmit={addAdminForm.handleSubmit(handleAddAdmin)} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...addAdminForm.register("email")} />
              {addAdminForm.formState.errors.email && (
                <p className="text-sm text-destructive">{addAdminForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...addAdminForm.register("name")} />
              {addAdminForm.formState.errors.name && (
                <p className="text-sm text-destructive">{addAdminForm.formState.errors.name.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddAdminOpen(false)}>Cancel</Button>
              <Button type="submit">Add admin</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tenant?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will soft-delete the tenant. You can undo this from the
            backend if needed.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
