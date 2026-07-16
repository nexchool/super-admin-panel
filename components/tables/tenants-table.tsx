"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pause, Play, KeyRound, ExternalLink } from "lucide-react";
import type { TenantListItem } from "@/types";

interface TenantsTableProps {
  data: TenantListItem[];
  onSuspendActivate?: (tenant: TenantListItem) => void;
  onResetAdmin?: (tenant: TenantListItem) => void;
  onOpenAdminWeb?: (tenant: TenantListItem) => void;
}

const formatPrice = (n: number | null) =>
  n != null
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
    : "—";

export function TenantsTable({
  data,
  onSuspendActivate,
  onResetAdmin,
  onOpenAdminWeb,
}: TenantsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Subdomain</TableHead>
          <TableHead className="text-right">Price / student / yr</TableHead>
          <TableHead className="text-right">Students</TableHead>
          <TableHead className="text-right">Teachers</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {(Array.isArray(data) ? data : []).map((tenant) => (
          <TableRow key={tenant.id}>
            <TableCell className="font-medium">{tenant.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {tenant.subdomain}
            </TableCell>
            <TableCell className="text-right">
              {formatPrice(tenant.pricePerStudentPerYear)}
              {tenant.discountPercentage != null && tenant.discountPercentage > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  −{tenant.discountPercentage}%
                </span>
              )}
            </TableCell>
            <TableCell className="text-right">{tenant.studentsCount}</TableCell>
            <TableCell className="text-right">{tenant.teachersCount}</TableCell>
            <TableCell>
              <Badge
                variant={
                  tenant.status === "active" ? "success" : "destructive"
                }
              >
                {tenant.status}
              </Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/tenants/${tenant.id}`}>
                      <Eye className="mr-2 size-4" />
                      View
                    </Link>
                  </DropdownMenuItem>
                  {onOpenAdminWeb && tenant.status === "active" && (
                    <DropdownMenuItem onClick={() => onOpenAdminWeb(tenant)}>
                      <ExternalLink className="mr-2 size-4" />
                      Open admin-web
                    </DropdownMenuItem>
                  )}
                  {onSuspendActivate && (
                    <DropdownMenuItem onClick={() => onSuspendActivate(tenant)}>
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
                    </DropdownMenuItem>
                  )}
                  {onResetAdmin && (
                    <DropdownMenuItem onClick={() => onResetAdmin(tenant)}>
                      <KeyRound className="mr-2 size-4" />
                      Reset Admin
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
