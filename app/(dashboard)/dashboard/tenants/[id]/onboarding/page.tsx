import { OnboardingForm } from "./onboarding-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TenantOnboardingPage({ params }: PageProps) {
  const { id } = await params;
  return <OnboardingForm tenantId={id} />;
}
