import { PrismaClient, Role, SurveyStatus, SurveyMode, QuestionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with reproducible synthetic test data...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Seed Users
  const owner1 = await prisma.user.upsert({
    where: { email: 'owner1@survey.local' },
    update: {
      passwordHash,
      fullName: 'Dr. Owner One',
      role: Role.SURVEY_OWNER,
    },
    create: {
      email: 'owner1@survey.local',
      passwordHash,
      fullName: 'Dr. Owner One',
      role: Role.SURVEY_OWNER,
    },
  });

  const owner2 = await prisma.user.upsert({
    where: { email: 'owner2@survey.local' },
    update: {
      passwordHash,
      fullName: 'Prof. Owner Two',
      role: Role.SURVEY_OWNER,
    },
    create: {
      email: 'owner2@survey.local',
      passwordHash,
      fullName: 'Prof. Owner Two',
      role: Role.SURVEY_OWNER,
    },
  });

  const resp1 = await prisma.user.upsert({
    where: { email: 'resp1@survey.local' },
    update: {
      passwordHash,
      fullName: 'Student Respondent One',
      role: Role.RESPONDENT,
    },
    create: {
      email: 'resp1@survey.local',
      passwordHash,
      fullName: 'Student Respondent One',
      role: Role.RESPONDENT,
    },
  });

  const resp2 = await prisma.user.upsert({
    where: { email: 'resp2@survey.local' },
    update: {
      passwordHash,
      fullName: 'Student Respondent Two',
      role: Role.RESPONDENT,
    },
    create: {
      email: 'resp2@survey.local',
      passwordHash,
      fullName: 'Student Respondent Two',
      role: Role.RESPONDENT,
    },
  });

  console.log(`Seeded users: ${owner1.email}, ${owner2.email}, ${resp1.email}, ${resp2.email}`);

  // 2. Seed Survey 1 (PUBLISHED - CPE 334 Midterm Feedback)
  let survey1 = await prisma.survey.findFirst({
    where: { ownerId: owner1.id, title: 'CPE 334 Midterm Feedback' },
  });

  if (!survey1) {
    survey1 = await prisma.survey.create({
      data: {
        title: 'CPE 334 Midterm Feedback',
        description: 'Midterm evaluation for CPE 334 Software Engineering course',
        status: SurveyStatus.PUBLISHED,
        mode: SurveyMode.IDENTIFIED,
        ownerId: owner1.id,
        publishedAt: new Date(),
        questions: {
          create: [
            {
              prompt: 'How would you rate the pacing of the software engineering lectures?',
              questionType: QuestionType.SINGLE_CHOICE,
              isRequired: true,
              orderIndex: 0,
              options: {
                create: [
                  { label: 'Too Fast', orderIndex: 0 },
                  { label: 'Just Right', orderIndex: 1 },
                  { label: 'Too Slow', orderIndex: 2 },
                ],
              },
            },
            {
              prompt: 'What SE topic or practice was most valuable to you so far?',
              questionType: QuestionType.SHORT_TEXT,
              isRequired: false,
              orderIndex: 1,
            },
          ],
        },
      },
    });
  }

  // 3. Seed Survey 2 (DRAFT - Internal Team Survey Draft)
  let survey2 = await prisma.survey.findFirst({
    where: { ownerId: owner1.id, title: 'Internal Team Survey Draft' },
  });

  if (!survey2) {
    survey2 = await prisma.survey.create({
      data: {
        title: 'Internal Team Survey Draft',
        description: 'Internal planning draft for team workflow',
        status: SurveyStatus.DRAFT,
        mode: SurveyMode.IDENTIFIED,
        ownerId: owner1.id,
        questions: {
          create: [
            {
              prompt: 'Which communication platform do you prefer for group collaboration?',
              questionType: QuestionType.SINGLE_CHOICE,
              isRequired: true,
              orderIndex: 0,
              options: {
                create: [
                  { label: 'Discord', orderIndex: 0 },
                  { label: 'Slack', orderIndex: 1 },
                  { label: 'Microsoft Teams', orderIndex: 2 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  // 4. Seed Survey 3 (PUBLISHED - Owner 2 Course Pulse)
  let survey3 = await prisma.survey.findFirst({
    where: { ownerId: owner2.id, title: 'Owner 2 Course Pulse' },
  });

  if (!survey3) {
    survey3 = await prisma.survey.create({
      data: {
        title: 'Owner 2 Course Pulse',
        description: 'Independent survey by Owner 2 to verify ownership isolation',
        status: SurveyStatus.PUBLISHED,
        mode: SurveyMode.IDENTIFIED,
        ownerId: owner2.id,
        publishedAt: new Date(),
        questions: {
          create: [
            {
              prompt: 'Are the instructions for the group project clear?',
              questionType: QuestionType.SINGLE_CHOICE,
              isRequired: true,
              orderIndex: 0,
              options: {
                create: [
                  { label: 'Very Clear', orderIndex: 0 },
                  { label: 'Somewhat Clear', orderIndex: 1 },
                  { label: 'Unclear', orderIndex: 2 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  console.log('Seeded surveys successfully: 2 Published, 1 Draft.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
