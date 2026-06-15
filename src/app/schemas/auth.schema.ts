import { z } from "zod";
import { Roles } from "@prisma/client";
import { TopUpSource } from "@prisma/client";

export const registerSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters"),

  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters"),

  email: z
    .email("Invalid email address"),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),

  phoneNumber: z
    .string()
    .min(11, "Phone number must be at least 11 digits"),

  token: z
    .string()
    .min(11, "Registration token is required"),

  role: z.enum(Roles),

  guarantorName: z
    .string()
    .min(2, "Guarantor name is too short")
    .optional(),

  guarantorPhone: z
    .string()
    .min(11, "Guarantor phone number is too short")
    .optional(),

  guarantorAddress: z
    .string()
    .min(5, "Guarantor address is too short")
    .optional(),

  address: z
    .string()
    .min(5, "Address is too short")
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(11, "Registration token is required"),
});

export const createREGTokenSchema = z.object({
  role: z.enum(Roles),
});

export const getTokensSchema = z.object({
  issued_by: z.string().min(1, "Issued by is required"),
});

export const addTopUpSchema = z.object({
  amount: z.coerce.number().min(10000, "Amount must be at least 10000"),
  allocated_from: z.enum([
    "COMPANY_RESERVE",
    "GOVERNMENT_TOP_UP",
    "EXTERNAL_OTHER_SOURCE",
  ]),
  allocationNote: z.string().optional(),
});

export const reverseTopUpSchema = z.object({
  id: z.string().min(1, "Top up ID is required"),
})
export type LoginInput = z.infer<typeof loginSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;

export type VerifyTokenInput = z.infer<typeof verifyTokenSchema>;
