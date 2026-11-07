import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/environment';
import { HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';

const loginSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  const input = loginSchema.safeParse(req.body);
  if (!input.success) {
    next(new HttpError(400, 'VALIDATION_ERROR', 'A valid email and password are required.'));
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: input.data.email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        tokenVersion: true,
        passwordHash: true,
      },
    });

    if (!user || !(await bcrypt.compare(input.data.password, user.passwordHash))) {
      next(new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'));
      return;
    }

    const token = jwt.sign(
      { role: user.role, ver: user.tokenVersion },
      env.JWT_SECRET,
      {
        algorithm: 'HS256',
        subject: user.id,
        expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
      }
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      },
    });
  } catch (error) {
    next(error);
  }
}

export function getCurrentUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    next(new HttpError(401, 'TOKEN_REQUIRED', 'Authentication token is required.'));
    return;
  }

  const { id, email, fullName, role } = req.auth;
  res.status(200).json({ success: true, data: { id, email, fullName, role } });
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    next(new HttpError(401, 'TOKEN_REQUIRED', 'Authentication token is required.'));
    return;
  }

  try {
    await prisma.user.update({
      where: { id: req.auth.id },
      data: { tokenVersion: { increment: 1 } },
    });
    res.status(200).json({
      success: true,
      data: { message: 'Successfully logged out.' },
    });
  } catch (error) {
    next(error);
  }
}
