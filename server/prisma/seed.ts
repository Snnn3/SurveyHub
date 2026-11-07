import dotenv from 'dotenv';
import path from 'path';

// Load environment variables for local seed executions
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient, SurveyStatus, SurveyMode, QuestionType } from '@prisma/client';
import { seedUsers } from './seed-users';

const prisma = new PrismaClient();

// Deterministic UUIDs for seed records
const SEED_SURVEY_1_ID = '00000000-0000-4000-a000-000000000001';
const SEED_SURVEY_2_ID = '00000000-0000-4000-a000-000000000002';
const SEED_SURVEY_3_ID = '00000000-0000-4000-a000-000000000003';

const SEED_Q1_ID = '00000000-0000-4000-a000-000000000011';
const SEED_Q2_ID = '00000000-0000-4000-a000-000000000012';
const SEED_Q3_ID = '00000000-0000-4000-a000-000000000021';
const SEED_Q4_ID = '00000000-0000-4000-a000-000000000031';
const PREV_Q4_RATING_ID = '00000000-0000-4000-a000-000000000032';

const SEED_OPT_1_1_ID = '00000000-0000-4000-a000-000000000101';
const SEED_OPT_1_2_ID = '00000000-0000-4000-a000-000000000102';
const SEED_OPT_1_3_ID = '00000000-0000-4000-a000-000000000103';

const SEED_OPT_2_1_ID = '00000000-0000-4000-a000-000000000201';
const SEED_OPT_2_2_ID = '00000000-0000-4000-a000-000000000202';
const SEED_OPT_2_3_ID = '00000000-0000-4000-a000-000000000203';

interface SeedOption {
  id: string;
  label: string;
  orderIndex: number;
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function upsertQuestionOptions(
  tx: TransactionClient,
  questionId: string,
  options: SeedOption[]
): Promise<void> {
  for (const opt of options) {
    await tx.option.upsert({
      where: {
        questionId_label: {
          questionId,
          label: opt.label,
        },
      },
      update: {
        orderIndex: opt.orderIndex,
      },
      create: {
        id: opt.id,
        questionId,
        label: opt.label,
        orderIndex: opt.orderIndex,
      },
    });
  }
}

async function main() {
  console.log('Seeding database with reproducible synthetic test data...');

  // Execute all seed upserts within a single atomic transaction
  await prisma.$transaction(async (tx) => {
    const users = await seedUsers(tx);

    const owner1 = users['owner1@survey.local'];
    const owner2 = users['owner2@survey.local'];
    const resp1 = users['resp1@survey.local'];
    const resp2 = users['resp2@survey.local'];

    console.log(`Seeded users: ${owner1.email}, ${owner2.email}, ${resp1.email}, ${resp2.email}`);

    // 2. Seed Survey 1 (PUBLISHED - CPE 334 Midterm Feedback)
    const survey1 = await tx.survey.upsert({
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

    const q1 = await tx.question.upsert({
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

    const q1Options: SeedOption[] = [
      { id: SEED_OPT_1_1_ID, label: 'Too Fast', orderIndex: 0 },
      { id: SEED_OPT_1_2_ID, label: 'Just Right', orderIndex: 1 },
      { id: SEED_OPT_1_3_ID, label: 'Too Slow', orderIndex: 2 },
    ];

    await upsertQuestionOptions(tx, q1.id, q1Options);

    await tx.question.upsert({
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
    const survey2 = await tx.survey.upsert({
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

    const q3 = await tx.question.upsert({
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

    const q3Options: SeedOption[] = [
      { id: SEED_OPT_2_1_ID, label: 'Discord', orderIndex: 0 },
      { id: SEED_OPT_2_2_ID, label: 'Slack', orderIndex: 1 },
      { id: SEED_OPT_2_3_ID, label: 'Microsoft Teams', orderIndex: 2 },
    ];

    await upsertQuestionOptions(tx, q3.id, q3Options);

    // 4. Seed Survey 3 (PUBLISHED - Owner 2 Course Pulse with Rating question)
    const survey3 = await tx.survey.upsert({
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

    // Reconcile Survey 3 questions and options to ensure exactly 1 Rating question per SDS §2.5:
    // Decide whether remapping is safe BEFORE touching answers:
    // If choice options on SEED_Q4_ID (...031) are currently in use by existing responses,
    // do NOT remap numeric rating answers to ...031 (which would attach numeric answers to a choice question).
    // Instead, preserve the choice question separately and preserve the Rating question on PREV_Q4_RATING_ID (...032).
    const legacyOptionsInUse = await tx.answerOption.count({
      where: {
        option: { questionId: SEED_Q4_ID },
      },
    });

    const prevQ4 = await tx.question.findUnique({
      where: { id: PREV_Q4_RATING_ID },
      include: {
        answers: {
          select: { id: true, responseId: true, numberValue: true },
        },
      },
    });

    const ratingPayload = {
      surveyId: survey3.id,
      prompt: 'Overall, how would you rate this course so far (1 to 5)?',
      questionType: QuestionType.RATING,
      isRequired: true,
      orderIndex: 0,
      numberMin: 1,
      numberMax: 5,
    };

    if (legacyOptionsInUse > 0) {
      // Branch A: Legacy choice answers exist on SEED_Q4_ID.
      // Keep SEED_Q4_ID as the choice question to protect existing answer meaning,
      // and preserve/upsert PREV_Q4_RATING_ID as the canonical Rating question for Survey 3.
      console.warn(
        `[Seed] Notice: Legacy responses reference choice options for SEED_Q4_ID (${SEED_Q4_ID}). Preserving choice question and keeping Rating question on ${PREV_Q4_RATING_ID}.`
      );

      await tx.question.upsert({
        where: { id: PREV_Q4_RATING_ID },
        update: { ...ratingPayload, orderIndex: 1 },
        create: {
          id: PREV_Q4_RATING_ID,
          ...ratingPayload,
          orderIndex: 1,
        },
      });
    } else {
      // Branch B: No choice options are in use. It is 100% safe to make SEED_Q4_ID the canonical Rating question.
      await tx.option.deleteMany({
        where: { questionId: SEED_Q4_ID },
      });

      await tx.question.upsert({
        where: { id: SEED_Q4_ID },
        update: ratingPayload,
        create: {
          id: SEED_Q4_ID,
          ...ratingPayload,
        },
      });

      // Now safely reconcile any transient answers from PREV_Q4_RATING_ID without data loss
      if (prevQ4) {
        for (const ans of prevQ4.answers) {
          const existingCanonicalAnswer = await tx.answer.findUnique({
            where: {
              responseId_questionId: {
                responseId: ans.responseId,
                questionId: SEED_Q4_ID,
              },
            },
          });

          if (existingCanonicalAnswer) {
            // Both IDs have an answer row for this response.
            // Only merge/delete equivalent answers; abort if conflicting non-null ratings exist
            if (existingCanonicalAnswer.numberValue === null && ans.numberValue !== null) {
              await tx.answer.update({
                where: { id: existingCanonicalAnswer.id },
                data: { numberValue: ans.numberValue },
              });
              await tx.answer.delete({ where: { id: ans.id } });
            } else if (
              existingCanonicalAnswer.numberValue === ans.numberValue ||
              ans.numberValue === null
            ) {
              await tx.answer.delete({ where: { id: ans.id } });
            } else {
              throw new Error(
                `[Seed] Conflicting Q4 rating answers detected for response ${ans.responseId} (${existingCanonicalAnswer.numberValue} vs ${ans.numberValue}). Aborting seed to prevent discarding submitted response data.`
              );
            }
          } else {
            // Safe to reassign to canonical SEED_Q4_ID
            await tx.answer.update({
              where: { id: ans.id },
              data: { questionId: SEED_Q4_ID },
            });
          }
        }

        await tx.question.delete({ where: { id: PREV_Q4_RATING_ID } });
      }
    }

    console.log('Seeded surveys, questions, and options successfully via idempotent upsert.');
  });
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
