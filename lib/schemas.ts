import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const createTenantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subdomain: z
    .string()
    .min(1, "Subdomain is required")
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  contactEmail: z.string().email("Invalid email"),
  phone: z.string().optional(),
  address: z.string().optional(),
  planId: z.string().min(1, "Plan is required"),
  adminName: z.string().min(1, "Admin name is required"),
  adminEmail: z.string().email("Invalid admin email"),
});

export type CreateTenantFormValues = z.infer<typeof createTenantSchema>;

export const changePlanSchema = z.object({
  planId: z.string().min(1, "Plan is required"),
});

export type ChangePlanFormValues = z.infer<typeof changePlanSchema>;

export const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required"),
  priceMonthly: z.coerce.number().min(0, "Price must be ≥ 0"),
  maxStudents: z.coerce.number().int().min(0, "Must be ≥ 0"),
  maxTeachers: z.coerce.number().int().min(0, "Must be ≥ 0"),
  features: z.record(z.string(), z.boolean()).optional(),
});
export type CreatePlanFormValues = {
  name: string;
  priceMonthly: number;
  maxStudents: number;
  maxTeachers: number;
  features?: Record<string, boolean>;
};

export const editPlanSchema = createPlanSchema;
export type EditPlanFormValues = CreatePlanFormValues;

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
  default_plan_id: z.string().optional(),
  maintenance_mode: z.enum(["true", "false"]).optional(),
  session_timeout_minutes: z.string().optional(),
  max_login_attempts: z.string().optional(),
  email_from_name: z.string().optional(),
  support_email: z.string().email("Invalid email").optional().or(z.literal("")),
});
export type PlatformSettingsFormValues = z.infer<typeof platformSettingsSchema>;
