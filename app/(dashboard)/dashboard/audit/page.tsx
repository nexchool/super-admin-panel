"use client";

import { useState } from "react";
import { useAuditLogs } from "@/hooks/useApi";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PER_PAGE = 20;
const ACTION_OPTIONS = [
  "",
  "tenant.created",
  "tenant.updated",
  "tenant.suspended",
  "tenant.activated",
  "tenant.deleted",
  "tenant.pricing.updated",
  "tenant.features.updated",
  "school_admin.reset",
  "school_admin.created",
  "settings.updated",
];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters = {
    action: action || undefined,
    tenant_id: tenantId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const { data, isLoading, error } = useAuditLogs(page, PER_PAGE, filters);
  const items = (data?.items ?? []) as Array<{
    id: string;
    action: string;
    tenant_id: string | null;
    platform_admin_id: string | null;
    extra_data: Record<string, unknown> | null;
    created_at: string | null;
  }>;
  const totalPages = data?.pages ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className="p-8">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Audit logs</h1>

      <Card className="mb-6 rounded-xl">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <p className="text-sm text-muted-foreground">
            Filter platform actions by type, tenant, or date range.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label htmlFor="audit-action">Action</Label>
            <select
              id="audit-action"
              className="flex h-9 w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt || "all"} value={opt}>
                  {opt || "All"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-tenant">Tenant ID</Label>
            <Input
              id="audit-tenant"
              className="w-[200px]"
              placeholder="Tenant UUID"
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-from">From date</Label>
            <Input
              id="audit-from"
              type="date"
              className="w-[160px]"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-to">To date</Label>
            <Input
              id="audit-to"
              type="date"
              className="w-[160px]"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Log entries</CardTitle>
          <p className="text-sm text-muted-foreground">
            {total} result(s)
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : error ? (
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Failed to load audit logs"}
            </p>
          ) : !items.length ? (
            <p className="py-8 text-center text-muted-foreground">No audit entries found.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Tenant ID</TableHead>
                    <TableHead>Admin ID</TableHead>
                    <TableHead className="max-w-[200px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.action}</TableCell>
                      <TableCell className="max-w-[120px] truncate font-mono text-xs">
                        {log.tenant_id ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate font-mono text-xs">
                        {log.platform_admin_id ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {log.extra_data
                          ? JSON.stringify(log.extra_data)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
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
    </div>
  );
}
