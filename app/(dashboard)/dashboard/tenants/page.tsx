"use client";

import { useEffect, useState } from "react";
import { useTenants, useInvalidateTenants, useInvalidateDashboard } from "@/hooks/useApi";
import { TenantsTable } from "@/components/tables/tenants-table";
import { Pagination } from "@/components/tables/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreateTenantModal } from "@/components/forms/create-tenant-modal";
import { Plus, Search } from "lucide-react";
import type { TenantListItem } from "@/types";
import { api, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";

const LIMIT = 10;

export default function TenantsPage() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce the search box and jump back to page 1 whenever the term changes —
  // otherwise a search from page 20 looks empty.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error } = useTenants(page, LIMIT, debouncedSearch);
  const invalidateTenants = useInvalidateTenants();
  const invalidateDashboard = useInvalidateDashboard();

  const handleSuspendActivate = async (tenant: TenantListItem) => {
    try {
      const path =
        tenant.status === "active"
          ? `/api/platform/tenants/${tenant.id}/suspend`
          : `/api/platform/tenants/${tenant.id}/activate`;
      await api.patch(path);
      toast.success(tenant.status === "active" ? "Tenant suspended" : "Tenant activated");
      await invalidateTenants();
      await invalidateDashboard();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleResetAdmin = async (tenant: TenantListItem) => {
    try {
      await api.post(`/api/platform/tenants/${tenant.id}/reset-admin`);
      toast.success("Admin password reset link sent");
      await invalidateTenants();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">
          {error instanceof Error ? error.message : "Failed to load tenants"}
        </p>
      </div>
    );
  }

  const totalPages = data?.totalPages ?? 0;
  const tenants = data?.data ?? [];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Add tenant
        </Button>
      </div>

      <Card className="rounded-xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All tenants</CardTitle>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, subdomain, or email…"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              Loading…
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              {debouncedSearch
                ? `No tenants match "${debouncedSearch}".`
                : "No tenants yet."}
            </div>
          ) : (
            <>
              <TenantsTable
                data={tenants}
                onSuspendActivate={handleSuspendActivate}
                onResetAdmin={handleResetAdmin}
              />
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <CreateTenantModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          invalidateTenants();
          invalidateDashboard();
        }}
      />
    </div>
  );
}
