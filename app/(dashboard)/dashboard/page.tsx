"use client";

import type React from "react";
import { useDashboard } from "@/hooks/useApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Building2,
  Users,
  GraduationCap,
  DollarSign,
  TrendingUp,
} from "lucide-react";

const metricCards: Array<{
  key: keyof import("@/types").DashboardMetrics;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  format?: (v: number) => string;
}> = [
  { key: "totalTenants", label: "Total Tenants", icon: Building2 },
  { key: "activeTenants", label: "Active Tenants", icon: TrendingUp },
  { key: "suspendedTenants", label: "Suspended Tenants", icon: Building2 },
  { key: "totalStudents", label: "Total Students", icon: GraduationCap },
  { key: "totalTeachers", label: "Total Teachers", icon: Users },
  {
    key: "yearlyRevenue",
    label: "Yearly Revenue",
    icon: DollarSign,
    format: (v: number) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(v),
  },
];

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-8 h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "Failed to load dashboard"}
        </p>
      </div>
    );
  }

  const metrics = data?.metrics;
  const growth = data?.tenantGrowthByMonth ?? [];

  return (
    <div className="p-8">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">
        Dashboard
      </h1>

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metricCards.map(({ key, label, icon: Icon, format }) => {
          const value = metrics?.[key] ?? 0;
          return (
            <Card key={key} className="rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-semibold">
                  {format ? format(value) : value}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Tenant growth by month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            {growth.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={growth}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "var(--radius-lg)",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No growth data yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
