"use client";

import { Beaker, CircleDollarSign, Plug, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/api";
import { useIntegrationCapabilities } from "@/hooks/useApi";
import type { IntegrationCapability, IntegrationProvider } from "@/types";

/**
 * The platform-wide integrations catalog: what this build can send, and who
 * could send it — read from the provider registry
 * (`server/modules/integrations/registry.py`), not from any school's
 * configuration. That is the whole point of the page: it answers "can we
 * offer WhatsApp at all yet?" without opening a school, because a provider
 * being registered here says nothing about whether any tenant uses it.
 *
 * No tenant appears anywhere on this page — none of it is per-school. To
 * point a school at a vendor, open that school's Integrations tab instead
 * (`tenants/[id]/integrations-section.tsx`), which is the other side of this
 * same split: deployed code here, one school's configuration there.
 */
export default function IntegrationsCatalogPage() {
  const { data: capabilities, isLoading, error } = useIntegrationCapabilities();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations catalog</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          What this build can send, and who could send it. This list is read from the
          provider registry, so it describes the deployed code — not any school&apos;s
          settings. Nothing here is editable, and no tenant is involved: to configure a
          vendor for a specific school, open that school&apos;s Integrations tab.
        </p>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Loading integration capabilities…
          </CardContent>
        </Card>
      )}

      {!isLoading && error && (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {getErrorMessage(error)}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (!capabilities || capabilities.length === 0) && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No capabilities are registered in this build.
          </CardContent>
        </Card>
      )}

      {!isLoading &&
        !error &&
        capabilities?.map((capability) => (
          <CapabilityCard key={capability.capability} capability={capability} />
        ))}
    </div>
  );
}

function CapabilityCard({ capability }: { capability: IntegrationCapability }) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-4" />
          {capability.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {capability.providers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No providers are registered for this capability.
          </p>
        )}
        {capability.providers.map((provider) => (
          <ProviderRow key={provider.key} provider={provider} />
        ))}
      </CardContent>
    </Card>
  );
}

function ProviderRow({ provider }: { provider: IntegrationProvider }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">
          {provider.name}{" "}
          <span className="font-mono text-xs font-normal text-muted-foreground">
            ({provider.key})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {provider.isTestDouble && (
            <Badge variant="warning" className="gap-1">
              <Beaker className="size-3" />
              Test double — cannot run outside development
            </Badge>
          )}
          <Badge variant={provider.isBillable ? "secondary" : "success"} className="gap-1">
            <CircleDollarSign className="size-3" />
            {provider.isBillable ? "Billable" : "Free"}
          </Badge>
          <Badge
            variant={provider.supportsIdempotency ? "success" : "secondary"}
            className="gap-1"
          >
            <RefreshCw className="size-3" />
            {provider.supportsIdempotency ? "Supports idempotency" : "No idempotency support"}
          </Badge>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground">Required credentials</p>
        {provider.requiredCredentials.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            None — this provider needs no server credential.
          </p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-2">
            {provider.requiredCredentials.map((name) => (
              <li key={name}>
                <Badge variant="outline" className="font-mono">
                  {name}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Names of the environment variables this provider reads — never a value. Whether one
          is actually set is reported per school, once a school configures this provider (see
          that school&apos;s Integrations tab).
        </p>
      </div>
    </div>
  );
}
