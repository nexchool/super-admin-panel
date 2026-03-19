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
  updateTenantAdminSchema,
  type ChangePlanFormValues,
  type EditTenantFormValues,
  type AddTenantAdminFormValues,
  type UpdateTenantAdminFormValues,
} from "@/lib/schemas";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Pause, Play, KeyRound, Trash2, CreditCard, Pencil, UserPlus, Mail, MessageSquare, Bell, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [editingAdmin, setEditingAdmin] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [adminToRemove, setAdminToRemove] = useState<{ id: string; email: string; name?: string } | null>(null);

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
      logoUrl: tenant?.logoUrl ?? "",
      tagline: tenant?.tagline ?? "",
      boardAffiliation: tenant?.boardAffiliation ?? "",
    },
  });


  const addAdminForm = useForm<AddTenantAdminFormValues>({
    resolver: zodResolver(addTenantAdminSchema),
    defaultValues: { email: "", name: "" },
  });

  const editAdminForm = useForm<UpdateTenantAdminFormValues>({
    resolver: zodResolver(updateTenantAdminSchema),
    defaultValues: { email: "", name: "" },
  });


  const handleChangePlan = async (values: ChangePlanFormValues) => {
    try {
      await api.patch(`/api/platform/tenants/${id}/change-plan`, { plan_id: values.planId });
      toast.success("Plan updated");
      changePlanForm.reset({ planId: values.planId });
      setChangePlanOpen(false);
      await invalidateTenant();
      await invalidateTenants();
    } catch (e) {
      toast.error(getErrorMessage(e));
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
      toast.success(tenant.status === "active" ? "Tenant suspended" : "Tenant activated");
      await invalidateTenant();
      await invalidateTenants();
      await invalidateDashboard();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleResetAdmin = async () => {
    try {
      await api.post(`/api/platform/tenants/${id}/reset-admin`);
      toast.success("Admin password reset link sent");
      await invalidateTenant();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/platform/tenants/${id}`);
      toast.success("Tenant deleted");
      setDeleteConfirmOpen(false);
      await invalidateTenants();
      await invalidateDashboard();
      router.push("/dashboard/tenants");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleEditTenant = async (values: EditTenantFormValues) => {
    try {
      await api.patch(`/api/platform/tenants/${id}`, {
        name: values.name,
        contact_email: values.contactEmail,
        phone: values.phone || null,
        address: values.address || null,
        logo_url: values.logoUrl || null,
        tagline: values.tagline || null,
        board_affiliation: values.boardAffiliation || null,
      });
      toast.success("Tenant updated");
      setEditTenantOpen(false);
      await invalidateTenant();
      await invalidateTenants();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleAddAdmin = async (values: AddTenantAdminFormValues) => {
    try {
      await api.post(`/api/platform/tenants/${id}/admins`, {
        email: values.email,
        name: values.name,
      });
      toast.success("Admin added. Credentials will be sent by email.");
      setAddAdminOpen(false);
      addAdminForm.reset({ email: "", name: "" });
      await invalidateTenantAdmins();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleEditAdmin = async (values: UpdateTenantAdminFormValues) => {
    if (!editingAdmin) return;
    try {
      await api.patch(`/api/platform/tenants/${id}/admins/${editingAdmin.id}`, {
        email: values.email,
        name: values.name,
      });
      toast.success("Admin updated");
      setEditingAdmin(null);
      await invalidateTenantAdmins();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleRemoveAdmin = async () => {
    if (!adminToRemove) return;
    try {
      await api.delete(`/api/platform/tenants/${id}/admins/${adminToRemove.id}`);
      toast.success("Admin removed");
      setAdminToRemove(null);
      await invalidateTenantAdmins();
    } catch (e) {
      toast.error(getErrorMessage(e));
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
      toast.success("Notification settings updated");
      await invalidateNotificationSettings();
    } catch (e) {
      toast.error(getErrorMessage(e));
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
            {tenant.tagline && (
              <div>
                <p className="text-sm text-muted-foreground">Tagline</p>
                <p className="font-medium">{tenant.tagline}</p>
              </div>
            )}
            {tenant.boardAffiliation && (
              <div>
                <p className="text-sm text-muted-foreground">Board Affiliation</p>
                <p className="font-medium">{tenant.boardAffiliation}</p>
              </div>
            )}
            {tenant.logoUrl && (
              <div>
                <p className="text-sm text-muted-foreground">School Logo</p>
                <img
                  src={tenant.logoUrl}
                  alt="School Logo"
                  className="mt-1 h-12 w-12 rounded object-contain border border-border"
                />
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <span className="sr-only">Actions</span>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          editAdminForm.reset({ email: admin.email, name: admin.name ?? admin.email });
                          setEditingAdmin(admin);
                        }}
                      >
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setAdminToRemove(admin)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Remove admin
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                logoUrl: tenant.logoUrl ?? "",
                tagline: tenant.tagline ?? "",
                boardAffiliation: tenant.boardAffiliation ?? "",
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
            <div className="space-y-2">
              <Label>School Logo URL (optional)</Label>
              <Input
                {...editTenantForm.register("logoUrl")}
                placeholder="https://res.cloudinary.com/..."
              />
              {editTenantForm.formState.errors.logoUrl && (
                <p className="text-sm text-destructive">{editTenantForm.formState.errors.logoUrl.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Upload to Cloudinary and paste the URL here. Used on PDF receipts &amp; invoices.
              </p>
            </div>
            <div className="space-y-2">
              <Label>School Tagline (optional)</Label>
              <Input
                {...editTenantForm.register("tagline")}
                placeholder="e.g. English Medium School For Girls"
              />
            </div>
            <div className="space-y-2">
              <Label>Board Affiliation (optional)</Label>
              <Input
                {...editTenantForm.register("boardAffiliation")}
                placeholder="e.g. CBSE, ICSE, Gujarat State Board"
              />
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

      <Dialog open={!!editingAdmin} onOpenChange={(open) => !open && setEditingAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit school admin</DialogTitle>
          </DialogHeader>
          <form onSubmit={editAdminForm.handleSubmit(handleEditAdmin)} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...editAdminForm.register("email")} />
              {editAdminForm.formState.errors.email && (
                <p className="text-sm text-destructive">{editAdminForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...editAdminForm.register("name")} />
              {editAdminForm.formState.errors.name && (
                <p className="text-sm text-destructive">{editAdminForm.formState.errors.name.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingAdmin(null)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adminToRemove} onOpenChange={(open) => !open && setAdminToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove admin</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove {adminToRemove?.name || adminToRemove?.email} as a school admin? They will lose admin access to this tenant
            but their account will remain. You must keep at least one admin per tenant.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminToRemove(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveAdmin}>Remove admin</Button>
          </DialogFooter>
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
