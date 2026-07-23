"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OnboardingSectionProps {
  tenantId: string;
  tenantStatus?: string;
  onApplied?: () => void;
}

export function OnboardingSection({ tenantId, tenantStatus }: OnboardingSectionProps) {
  // The backend only seeds ACTIVE tenants; hide the tool otherwise so the
  // operator isn't handed a button that will 404.
  if (tenantStatus && tenantStatus !== "active") return null;

  return (
    <Card className="mt-6 rounded-xl">
      <CardHeader>
        <CardTitle>Onboarding</CardTitle>
        <p className="text-sm text-muted-foreground">
          Set up this school&apos;s academic year, branches, programmes, grades, and classes.
          Subjects are derived automatically from each programme&apos;s curriculum template —
          nothing is written until you review and apply.
        </p>
      </CardHeader>
      <CardContent>
        <Button asChild className="gap-2">
          <Link href={`/dashboard/tenants/${tenantId}/onboarding`}>
            Set up academic structure
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
