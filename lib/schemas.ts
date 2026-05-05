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
