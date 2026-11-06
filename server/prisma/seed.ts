import { PrismaClient, Role, SurveyStatus, SurveyMode, QuestionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Deterministic UUIDs for seed records
const SEED_SURVEY_1_ID = '00000000-0000-4000-a000-000000000001';
const SEED_SURVEY_2_ID = '00000000-0000-4000-a000-000000000002';
const SEED_SURVEY_3_ID = '00000000-0000-4000-a000-000000000003';

const SEED_Q1_ID = '00000000-0000-4000-a000-000000000011';
const SEED_Q2_ID = '00000000-0000-4000-a000-000000000012';
const SEED_Q3_ID = '00000000-0000-4000-a000-000000000021';
const SEED_Q4_ID = '00000000-0000-4000-a000-000000000031';

const SEED_OPT_1_1_ID = '00000000-0000-4000-a000-000000000101';
const SEED_OPT_1_2_ID = '00000000-0000-4000-a000-000000000102';
const SEED_OPT_1_3_ID = '00000000-0000-4000-a000-000000000103';

const SEED_OPT_2_1_ID = '00000000-0000-4000-a000-000000000201';
const SEED_OPT_2_2_ID = '00000000-0000-4000-a000-000000000202';
const SEED_OPT_2_3_ID = '00000000-0000-4000-a000-000000000203';

async function main() {
  console.log('Seeding database with reproducible synthetic test data...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Seed Users (idempotent upsert by email)
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

  // Clean up any legacy seed records with non-deterministic IDs
  await prisma.survey.deleteMany({
    where: {
      id: { notIn: [SEED_SURVEY_1_ID, SEED_SURVEY_2_ID, SEED_SURVEY_3_ID] },
      title: { in: ['CPE 334 Midterm Feedback', 'Internal Team Survey Draft', 'Owner 2 Course Pulse'] },
    },
  });

  // 2. Seed Survey 1 (PUBLISHED - CPE 334 Midterm Feedback)
  const survey1 = await prisma.survey.upsert({
    where: { id: SEED_SURVEY_1_ID },
    update: {
      title: 'CPE 334 Midterm Feedback',
      description: 'Midterm evaluation for CPE 334 Software Engineering course',
      status: SurveyStatus.PUBLISHED,
      mode: SurveyMode.IDENTIFIED,
      ownerId: owner1.id,
      publishedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
    create: {
      id: SEED_SURVEY_1_ID,
      title: 'CPE 334 Midterm Feedback',
      description: 'Midterm evaluation for CPE 334 Software Engineering course',
      status: SurveyStatus.PUBLISHED,
      mode: SurveyMode.IDENTIFIED,
      ownerId: owner1.id,
      publishedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
  });

  const q1 = await prisma.question.upsert({
    where: { id: SEED_Q1_ID },
    update: {
      surveyId: survey1.id,
      prompt: 'How would you rate the pacing of the software engineering lectures?',
      questionType: QuestionType.SINGLE_CHOICE,
      isRequired: true,
      orderIndex: 0,
    },
    create: {
      id: SEED_Q1_ID,
      surveyId: survey1.id,
      prompt: 'How would you rate the pacing of the software engineering lectures?',
      questionType: QuestionType.SINGLE_CHOICE,
      isRequired: true,
      orderIndex: 0,
    },
  });

  const q1Options = [
    { id: SEED_OPT_1_1_ID, label: 'Too Fast', orderIndex: 0 },
    { id: SEED_OPT_1_2_ID, label: 'Just Right', orderIndex: 1 },
    { id: SEED_OPT_1_3_ID, label: 'Too Slow', orderIndex: 2 },
  ];

  for (const opt of q1Options) {
    await prisma.option.upsert({
      where: {
        questionId_label: {
          questionId: q1.id,
          label: opt.label,
        },
      },
      update: {
        orderIndex: opt.orderIndex,
      },
      create: {
        id: opt.id,
        questionId: q1.id,
        label: opt.label,
        orderIndex: opt.orderIndex,
      },
    });
  }

  await prisma.question.upsert({
    where: { id: SEED_Q2_ID },
    update: {
      surveyId: survey1.id,
      prompt: 'What SE topic or practice was most valuable to you so far?',
      questionType: QuestionType.SHORT_TEXT,
      isRequired: false,
      orderIndex: 1,
    },
    create: {
      id: SEED_Q2_ID,
      surveyId: survey1.id,
      prompt: 'What SE topic or practice was most valuable to you so far?',
      questionType: QuestionType.SHORT_TEXT,
      isRequired: false,
      orderIndex: 1,
    },
  });

  // 3. Seed Survey 2 (DRAFT - Internal Team Survey Draft)
  const survey2 = await prisma.survey.upsert({
    where: { id: SEED_SURVEY_2_ID },
    update: {
      title: 'Internal Team Survey Draft',
      description: 'Internal planning draft for team workflow',
      status: SurveyStatus.DRAFT,
      mode: SurveyMode.IDENTIFIED,
      ownerId: owner1.id,
      publishedAt: null,
    },
    create: {
      id: SEED_SURVEY_2_ID,
      title: 'Internal Team Survey Draft',
      description: 'Internal planning draft for team workflow',
      status: SurveyStatus.DRAFT,
      mode: SurveyMode.IDENTIFIED,
      ownerId: owner1.id,
      publishedAt: null,
    },
  });

  const q3 = await prisma.question.upsert({
    where: { id: SEED_Q3_ID },
    update: {
      surveyId: survey2.id,
      prompt: 'Which communication platform do you prefer for group collaboration?',
      questionType: QuestionType.SINGLE_CHOICE,
      isRequired: true,
      orderIndex: 0,
    },
    create: {
      id: SEED_Q3_ID,
      surveyId: survey2.id,
      prompt: 'Which communication platform do you prefer for group collaboration?',
      questionType: QuestionType.SINGLE_CHOICE,
      isRequired: true,
      orderIndex: 0,
    },
  });

  const q3Options = [
    { id: SEED_OPT_2_1_ID, label: 'Discord', orderIndex: 0 },
    { id: SEED_OPT_2_2_ID, label: 'Slack', orderIndex: 1 },
    { id: SEED_OPT_2_3_ID, label: 'Microsoft Teams', orderIndex: 2 },
  ];

  for (const opt of q3Options) {
    await prisma.option.upsert({
      where: {
        questionId_label: {
          questionId: q3.id,
          label: opt.label,
        },
      },
      update: {
        orderIndex: opt.orderIndex,
      },
      create: {
        id: opt.id,
        questionId: q3.id,
        label: opt.label,
        orderIndex: opt.orderIndex,
      },
    });
  }

  // 4. Seed Survey 3 (PUBLISHED - Owner 2 Course Pulse)
  const survey3 = await prisma.survey.upsert({
    where: { id: SEED_SURVEY_3_ID },
    update: {
      title: 'Owner 2 Course Pulse',
      description: 'Independent survey by Owner 2 to verify ownership isolation',
      status: SurveyStatus.PUBLISHED,
      mode: SurveyMode.IDENTIFIED,
      ownerId: owner2.id,
      publishedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
    create: {
      id: SEED_SURVEY_3_ID,
      title: 'Owner 2 Course Pulse',
      description: 'Independent survey by Owner 2 to verify ownership isolation',
      status: SurveyStatus.PUBLISHED,
      mode: SurveyMode.IDENTIFIED,
      ownerId: owner2.id,
      publishedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
  });

  const q4 = await prisma.question.upsert({
    where: { id: SEED_Q4_ID },
    update: {
      surveyId: survey3.id,
      prompt: 'Overall, how would you rate this course so far (1 to 5)?',
      questionType: QuestionType.RATING,
      isRequired: true,
      orderIndex: 0,
      numberMin: 1,
      numberMax: 5,
    },
    create: {
      id: SEED_Q4_ID,
      surveyId: survey3.id,
      prompt: 'Overall, how would you rate this course so far (1 to 5)?',
      questionType: QuestionType.RATING,
      isRequired: true,
      orderIndex: 0,
      numberMin: 1,
      numberMax: 5,
    },
  });

  // Ensure no stale choice options exist for rating question
  await prisma.option.deleteMany({
    where: { questionId: q4.id },
  });

  console.log('Seeded surveys, questions, and options successfully via idempotent upsert.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
