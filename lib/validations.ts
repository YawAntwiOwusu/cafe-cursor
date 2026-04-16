import { z } from "zod";

/**
 * Schema de validación para registro de usuarios
 * Usa Zod para validación robusta en servidor y cliente
 */
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim()
    .regex(
      /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/,
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    ),
  email: z
    .string()
    .email("Please enter a valid email")
    .max(255, "Email cannot exceed 255 characters")
    .toLowerCase()
    .trim(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
