// Esquemas de validación (zod) para los endpoints de autenticación
const { z } = require('zod');

// Normaliza el email (sin espacios y en minúsculas) antes de validarlo
const email = z
  .string({ error: 'El email es requerido' })
  .trim()
  .toLowerCase()
  .pipe(z.email('El email no es válido'));

const registerSchema = z.object({
  name: z
    .string({ error: 'El nombre es requerido' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres'),
  email,
  password: z
    .string({ error: 'La contraseña es requerida' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe tener al menos un número'),
  // Solo se permiten estos dos roles al registrarse (nunca ADMIN)
  role: z
    .enum(['OYENTE', 'ARTISTA'], { error: 'El rol solo puede ser OYENTE o ARTISTA' })
    .optional(),
});

const loginSchema = z.object({
  email,
  password: z
    .string({ error: 'La contraseña es requerida' })
    .min(1, 'La contraseña es requerida'),
});

// Usado por /refresh y /logout
const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ error: 'El refreshToken es requerido' })
    .min(1, 'El refreshToken es requerido'),
});

module.exports = { registerSchema, loginSchema, refreshTokenSchema };
