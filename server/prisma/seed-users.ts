import { Prisma, Role, User } from '@prisma/client';
import { hashSeedPassword } from './password';

export async function seedUsers(tx: Prisma.TransactionClient): Promise<Record<string, User>> {
  const passwordHash = await hashSeedPassword('Password123!');
  const userFixtures = [
    { email: 'owner1@survey.local', fullName: 'Dr. Owner One', role: Role.SURVEY_OWNER },
    { email: 'owner2@survey.local', fullName: 'Prof. Owner Two', role: Role.SURVEY_OWNER },
    { email: 'resp1@survey.local', fullName: 'Student Respondent One', role: Role.RESPONDENT },
    { email: 'resp2@survey.local', fullName: 'Student Respondent Two', role: Role.RESPONDENT },
  ];

  const users: Record<string, User> = {};
  for (const user of userFixtures) {
    users[user.email] = await tx.user.upsert({
      where: { email: user.email },
      update: { passwordHash, fullName: user.fullName, role: user.role },
      create: { email: user.email, passwordHash, fullName: user.fullName, role: user.role },
    });
  }

  return users;
}
