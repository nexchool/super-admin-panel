"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useNotificationTemplates,
  useInvalidateNotificationTemplates,
  useTenants,
} from "@/hooks/useApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  notificationTemplateSchema,
  type NotificationTemplateFormValues,
} from "@/lib/schemas";
import { api } from "@/lib/api";
import { Plus, Pencil, Trash2, Eye, Mail } from "lucide-react";

const NOTIFICATION_CATEGORIES = ["AUTH", "STUDENT", "PLATFORM", "FINANCE", "SYSTEM"];
const NOTIFICATION_CHANNELS = ["EMAIL", "SMS", "IN_APP"];
const NOTIFICATION_TYPES = [
  "ADMIN_CREDENTIALS",
  "ADMIN_PASSWORD_RESET",
  "EMAIL_VERIFICATION",
  "FEE_DUE",
  "FEE_OVERDUE",
  "PAYMENT_FAILED",
  "PAYMENT_RECEIVED",
  "PASSWORD_RESET",
  "STUDENT_CREDENTIALS",
  "TENANT_CHANNEL_ENABLED",
  "WELCOME",
].sort();
const PER_PAGE = 50;

export default function NotificationTemplatesPage() {
  const searchParams = useSearchParams();
  const tenantIdParam = searchParams.get("tenant_id") ?? undefined;

  const [tenantId, setTenantId] = useState<string | undefined>(tenantIdParam || "");
  const [category, setCategory] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<{
    id: string;
    tenant_id: string | null;
    type: string;
    channel: string;
    category: string;
    subject_template: string;
    body_template: string;
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string } | null>(null);
  const [previewData, setPreviewData] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [testSendLoading, setTestSendLoading] = useState(false);

  useEffect(() => {
    if (tenantIdParam !== undefined) setTenantId(tenantIdParam || "global");
  }, [tenantIdParam]);

  const { data: tenantsData } = useTenants(1, 500);
  const tenants = tenantsData?.data ?? [];

  const filters = {
    tenantId: tenantId === "" || tenantId === "all" ? undefined : tenantId,
    category: category || undefined,
    type: typeFilter || undefined,
    channel: channel || undefined,
    page,
    perPage: PER_PAGE,
  };

  const { data, isLoading, error } = useNotificationTemplates(filters);
  const invalidateTemplates = useInvalidateNotificationTemplates();

  const items = data?.items ?? [];
  const pagination = data?.pagination ?? { page: 1, per_page: PER_PAGE, total: 0, pages: 0 };

  const createForm = useForm<NotificationTemplateFormValues>({
    resolver: zodResolver(notificationTemplateSchema),
    defaultValues: {
      subject: "",
      body: "",
      tenantId: "",
      category: "PLATFORM",
      channel: "EMAIL",
      type: "",
    },
  });

  const editForm = useForm<NotificationTemplateFormValues>({
    resolver: zodResolver(notificationTemplateSchema),
    defaultValues: {
      subject: "",
      body: "",
      tenantId: "",
      category: "PLATFORM",
      channel: "EMAIL",
      type: "",
    },
  });

  const handleCreate = async (values: NotificationTemplateFormValues) => {
    try {
      await api.post("/api/platform/notification-templates", {
        type: values.type,
        channel: values.channel,
        category: values.category,
        subject_template: values.subject,
        body_template: values.body,
        tenant_id: values.tenantId || null,
      });
      setCreateOpen(false);
      createForm.reset({
        subject: "",
        body: "",
        tenantId: tenantId && tenantId !== "global" ? tenantId : "",
        category: "PLATFORM",
        channel: "EMAIL",
        type: "",
      });
      await invalidateTemplates();
    } catch (e) {
      console.error(e);
    }
  };

  const openEdit = (template: {
    id: string;
    tenant_id: string | null;
    type: string;
    channel: string;
    category: string;
    subject_template: string;
    body_template: string;
  }) => {
    setTemplateToEdit(template);
    editForm.reset({
      subject: template.subject_template,
      body: template.body_template,
      tenantId: template.tenant_id ?? "",
      category: template.category,
      channel: template.channel,
      type: template.type,
    });
    setEditOpen(true);
  };

  const handleEdit = async (values: NotificationTemplateFormValues) => {
    if (!templateToEdit) return;
    try {
      await api.patch(`/api/platform/notification-templates/${templateToEdit.id}`, {
        type: values.type,
        channel: values.channel,
        category: values.category,
        subject_template: values.subject,
        body_template: values.body,
      });
      setEditOpen(false);
      setTemplateToEdit(null);
      await invalidateTemplates();
    } catch (e) {
      console.error(e);
    }
  };

  const openDelete = (template: { id: string }) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const handlePreviewCreate = async () => {
    const values = createForm.getValues();
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    try {
      const res = await api.post<{ data?: { subject?: string; body?: string } }>(
        "/api/platform/notification-templates/preview",
        {
          subject_template: values.subject,
          body_template: values.body,
        }
      );
      const d = res?.data ?? {};
      setPreviewData({ subject: d.subject ?? "", body: d.body ?? "" });
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewEdit = async () => {
    const values = editForm.getValues();
    if (!templateToEdit) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    try {
      const res = await api.post<{ data?: { subject?: string; body?: string } }>(
        `/api/platform/notification-templates/${templateToEdit.id}/preview`,
        {
          subject_template: values.subject,
          body_template: values.body,
        }
      );
      const d = res?.data ?? {};
      setPreviewData({ subject: d.subject ?? "", body: d.body ?? "" });
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTestSend = async () => {
    if (!templateToEdit) return;
    setTestSendLoading(true);
    try {
      await api.post(`/api/platform/notification-templates/${templateToEdit.id}/test-send`);
    } catch (e) {
      console.error(e);
    } finally {
      setTestSendLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;
    try {
      await api.delete(`/api/platform/notification-templates/${templateToDelete.id}`);
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
      await invalidateTemplates();
    } catch (e) {
      console.error(e);
    }
  };

  const subjectPreview = (s: string) =>
    s.length > 50 ? `${s.slice(0, 50)}…` : s;

  return (
    <div className="p-8">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">
        Notification templates
      </h1>

      <Card className="mb-6 rounded-xl">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <p className="text-sm text-muted-foreground">
            Filter templates by tenant, category, type, or channel.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label htmlFor="filter-tenant">Tenant</Label>
            <Select
              value={tenantId === "" ? "all" : tenantId}
              onValueChange={(v) => {
                setTenantId(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger id="filter-tenant" className="w-[200px]">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-category">Category</Label>
            <Select
              value={category || "all"}
              onValueChange={(v) => {
                setCategory(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger id="filter-category" className="w-[160px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {NOTIFICATION_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-type">Type</Label>
            <Select
              value={typeFilter || "all"}
              onValueChange={(v) => {
                setTypeFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger id="filter-type" className="w-[220px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px] overflow-y-auto">
                <SelectItem value="all">All</SelectItem>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-channel">Channel</Label>
            <Select
              value={channel || "all"}
              onValueChange={(v) => {
                setChannel(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger id="filter-channel" className="w-[140px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {NOTIFICATION_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Templates</CardTitle>
          <Button
            onClick={() => {
              createForm.reset({
                subject: "",
                body: "",
                tenantId: tenantId && tenantId !== "global" && tenantId !== "all" ? tenantId : "",
                category: "PLATFORM",
                channel: "EMAIL",
                type: "",
              });
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add template
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : error ? (
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Failed to load templates"}
            </p>
          ) : !items.length ? (
            <p className="py-8 text-center text-muted-foreground">
              No templates found. Create one to get started.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subject preview</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.tenant_id ? (
                          tenants.find((tn) => tn.id === t.tenant_id)?.name ?? t.tenant_id
                        ) : (
                          <span className="text-muted-foreground">Global</span>
                        )}
                      </TableCell>
                      <TableCell>{t.type}</TableCell>
                      <TableCell>{t.channel}</TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {subjectPreview(t.subject_template)}
                      </TableCell>
                      <TableCell>
                        {t.is_system ? (
                          <Badge variant="secondary">System</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(t)}
                            aria-label="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDelete(t)}
                            aria-label="Delete"
                            className="text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setPreviewData(null);
          setPreviewError(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create template</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-type">Type</Label>
              <Input
                id="create-type"
                placeholder="e.g. EMAIL_VERIFICATION"
                {...createForm.register("type")}
              />
              {createForm.formState.errors.type && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.type.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-channel">Channel</Label>
              <Select
                value={createForm.watch("channel")}
                onValueChange={(v) => createForm.setValue("channel", v)}
              >
                <SelectTrigger id="create-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-category">Category</Label>
              <Select
                value={createForm.watch("category")}
                onValueChange={(v) => createForm.setValue("category", v)}
              >
                <SelectTrigger id="create-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-tenant">Tenant (optional)</Label>
              <Select
                value={createForm.watch("tenantId") || "none"}
                onValueChange={(v) => createForm.setValue("tenantId", v === "none" ? "" : v)}
              >
                <SelectTrigger id="create-tenant">
                  <SelectValue placeholder="Global" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Global</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-subject">Subject</Label>
              <Input id="create-subject" {...createForm.register("subject")} />
              {createForm.formState.errors.subject && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.subject.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-body">Body</Label>
              <textarea
                id="create-body"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                {...createForm.register("body")}
              />
              {createForm.formState.errors.body && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.body.message}
                </p>
              )}
            </div>
            {(previewData || previewError) && (
              <div className="space-y-2 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Preview</p>
                {previewError && (
                  <p className="text-sm text-destructive">{previewError}</p>
                )}
                {previewData && (
                  <>
                    <p className="text-xs text-muted-foreground">Subject:</p>
                    <p className="text-sm">{previewData.subject}</p>
                    <p className="text-xs text-muted-foreground mt-2">Body:</p>
                    <iframe
                      srcDoc={previewData.body}
                      title="Email preview"
                      className="h-48 w-full overflow-auto rounded border border-border bg-muted/30"
                      sandbox="allow-same-origin"
                    />
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewCreate}
                disabled={previewLoading}
              >
                <Eye className="mr-2 size-4" />
                {previewLoading ? "Loading…" : "Preview"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) setTemplateToEdit(null);
          setEditOpen(open);
          if (!open) setPreviewData(null);
          setPreviewError(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-type">Type</Label>
              <Input id="edit-type" {...editForm.register("type")} />
              {editForm.formState.errors.type && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.type.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-channel">Channel</Label>
              <Select
                value={editForm.watch("channel")}
                onValueChange={(v) => editForm.setValue("channel", v)}
              >
                <SelectTrigger id="edit-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={editForm.watch("category")}
                onValueChange={(v) => editForm.setValue("category", v)}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject</Label>
              <Input id="edit-subject" {...editForm.register("subject")} />
              {editForm.formState.errors.subject && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.subject.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-body">Body</Label>
              <textarea
                id="edit-body"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                {...editForm.register("body")}
              />
              {editForm.formState.errors.body && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.body.message}
                </p>
              )}
            </div>
            {(previewData || previewError) && (
              <div className="space-y-2 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Preview</p>
                {previewError && (
                  <p className="text-sm text-destructive">{previewError}</p>
                )}
                {previewData && (
                  <>
                    <p className="text-xs text-muted-foreground">Subject:</p>
                    <p className="text-sm">{previewData.subject}</p>
                    <p className="text-xs text-muted-foreground mt-2">Body:</p>
                    <iframe
                      srcDoc={previewData.body}
                      title="Email preview"
                      className="h-48 w-full overflow-auto rounded border border-border bg-muted/30"
                      sandbox="allow-same-origin"
                    />
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewEdit}
                disabled={previewLoading}
              >
                <Eye className="mr-2 size-4" />
                {previewLoading ? "Loading…" : "Preview"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestSend}
                disabled={testSendLoading || templateToEdit?.channel !== "EMAIL"}
              >
                <Mail className="mr-2 size-4" />
                {testSendLoading ? "Sending…" : "Send test email"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this notification template.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
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
