import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * HTML <input> always yields strings, even for type="number"/"date". We
 * keep these as `z.string().optional()` to stay aligned with the form's
 * input type, and validate format with `.refine`. Empty string = unset.
 */
const optionalNonNegativeNumberString = z
  .string()
  .optional()
  .refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0),
    "Must be ≥ 0"
  );

const optionalDate = z
  .string()
  .optional()
  .refine(
    (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
    "Use YYYY-MM-DD"
  );

const optionalDiscountString = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      const n = Number(v);
      return !Number.isNaN(n) && n >= 0 && n <= 100;
    },
    "Must be between 0 and 100"
  );

export const createTenantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subdomain: z
    .string()
    .min(1, "Subdomain is required")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  contactEmail: z.string().email("Invalid email"),
  phone: z.string().optional(),
  address: z.string().optional(),
  adminName: z.string().min(1, "Admin name is required"),
  adminEmail: z.string().email("Invalid admin email"),
  pricePerStudentPerYear: optionalNonNegativeNumberString,
  discountPercentage: optionalDiscountString,
  discountStartDate: optionalDate,
  discountEndDate: optionalDate,
  featureFlags: z.record(z.string(), z.boolean()).optional(),
});

export type CreateTenantFormValues = z.infer<typeof createTenantSchema>;

export const editTenantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactEmail: z.string().email("Invalid email"),
  phone: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tagline: z.string().max(255).optional(),
  boardAffiliation: z.string().max(100).optional(),
});
export type EditTenantFormValues = z.infer<typeof editTenantSchema>;

export const tenantPricingSchema = z
  .object({
    pricePerStudentPerYear: optionalNonNegativeNumberString,
    discountPercentage: optionalDiscountString,
    discountStartDate: optionalDate,
    discountEndDate: optionalDate,
  })
  .refine(
    (data) => {
      if (!data.discountStartDate || !data.discountEndDate) return true;
      return data.discountStartDate <= data.discountEndDate;
    },
    {
      message: "Start date must be on or before end date",
      path: ["discountEndDate"],
    }
  );
export type TenantPricingFormValues = z.infer<typeof tenantPricingSchema>;

export const addTenantAdminSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required"),
});
export type AddTenantAdminFormValues = z.infer<typeof addTenantAdminSchema>;

export const updateTenantAdminSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name is required"),
});
export type UpdateTenantAdminFormValues = z.infer<typeof updateTenantAdminSchema>;

export const notificationTemplateSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  tenantId: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  channel: z.string().min(1, "Channel is required"),
  type: z.string().min(1, "Type is required"),
});
export type NotificationTemplateFormValues = z.infer<typeof notificationTemplateSchema>;

export const platformSettingsSchema = z.object({
  platform_name: z.string().optional(),
  maintenance_mode: z.enum(["true", "false"]).optional(),
  session_timeout_minutes: z.string().optional(),
  max_login_attempts: z.string().optional(),
  email_from_name: z.string().optional(),
  support_email: z.string().email("Invalid email").optional().or(z.literal("")),
});
export type PlatformSettingsFormValues = z.infer<typeof platformSettingsSchema>;

// Onboarding config. Field names are the server's, not camelCase, because this
// object is posted verbatim to /seed/preview and /seed/apply.
//
// There is deliberately no `subjects` or `offerings` here: the server derives
// both from each programme's template_board_code. A draft that carried them
// could seed a stale catalogue, and the server rejects any config that declares
// them.
export const onboardingProgrammeSchema = z.object({
  code: z.string().min(1, "Programme code is required"),
  name: z.string().min(1, "Programme name is required"),
  board: z.string().min(1, "Board is required"),
  medium: z.string().optional(),
  template_board_code: z.string().min(1, "Pick a curriculum template"),
});

export const onboardingTermSchema = z.object({
  name: z.string().min(1, "Term name is required"),
  code: z.string().optional(),
  sequence: z.number().int().min(1),
  start: z.string().min(1, "Start date is required"),
  end: z.string().min(1, "End date is required"),
});

export const onboardingClassSchema = z.object({
  unit: z.string().min(1),
  programme: z.string().min(1),
  grade: z.string().min(1),
  sections: z.array(z.string().min(1)).min(1, "At least one section"),
});

export const onboardingExtraSubjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  programme: z.string().min(1),
  grades: z.array(z.string().min(1)).min(1),
  weekly: z.number().int().min(1).default(1),
  type: z.enum(["mandatory", "elective"]).default("elective"),
});

export const onboardingConfigSchema = z.object({
  academic_year: z.object({
    name: z.string().min(1, "Academic year name is required"),
    start: z.string().min(1, "Start date is required"),
    end: z.string().min(1, "End date is required"),
    active: z.boolean().default(true),
  }),
  terms: z.array(onboardingTermSchema).default([]),
  units: z
    .array(
      z.object({
        code: z.string().min(1, "Branch code is required"),
        name: z.string().min(1, "Branch name is required"),
      })
    )
    .min(1, "At least one branch"),
  programmes: z.array(onboardingProgrammeSchema).min(1, "At least one programme"),
  grades: z
    .array(z.object({ name: z.string().min(1), sequence: z.number().int().min(1) }))
    .min(1, "At least one grade"),
  classes: z.array(onboardingClassSchema).default([]),
  extra_subjects: z.array(onboardingExtraSubjectSchema).default([]),
});

export type OnboardingConfig = z.infer<typeof onboardingConfigSchema>;
export type OnboardingTerm = z.infer<typeof onboardingTermSchema>;
export type OnboardingClass = z.infer<typeof onboardingClassSchema>;
