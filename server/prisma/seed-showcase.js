const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function assertShowcaseDatabaseTarget() {
  let databaseUrl;
  try {
    databaseUrl = new URL(process.env.DATABASE_URL || '');
  } catch {
    throw new Error('DATABASE_URL is missing or invalid.');
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  const target = process.env.SHOWCASE_SEED_TARGET || 'local';
  const runningInCloudRun = Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB || process.env.CLOUD_RUN_EXECUTION);

  if (target === 'local') {
    if (runningInCloudRun || databaseUrl.hostname !== 'db' || databaseName !== 'surveyhub') {
      throw new Error('Local showcase seed only accepts the Compose surveyhub database.');
    }
    return;
  }

  if (target === 'cloud') {
    const teamPrefix = process.env.TEAM_PREFIX || '';
    const expectedSocket = `/cloudsql/cpe-se-course-2026:asia-southeast1:${teamPrefix}-pg`;
    const teamPrefixIsValid = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(teamPrefix);
    if (
      !process.env.CLOUD_RUN_JOB ||
      process.env.CLOUD_RUN_JOB !== `${teamPrefix}-migrate` ||
      process.env.GCP_PROJECT_ID !== 'cpe-se-course-2026' ||
      process.env.GCP_REGION !== 'asia-southeast1' ||
      !teamPrefixIsValid ||
      databaseUrl.hostname !== 'localhost' ||
      databaseName !== teamPrefix ||
      databaseUrl.searchParams.get('host') !== expectedSocket
    ) {
      throw new Error('Cloud showcase seed requires the matching team migration job, database, and attached SQL instance.');
    }
    return;
  }

  throw new Error('SHOWCASE_SEED_TARGET must be either local or cloud.');
}

const id = (value) => `00000000-0000-4000-a000-${String(value).padStart(12, '0')}`;
const likertOptions = [
  'Strongly disagree',
  'Disagree',
  'Neither agree nor disagree',
  'Agree',
  'Strongly agree',
];

const surveys = [
  {
    id: 4,
    ownerEmail: 'owner1@survey.local',
    title: 'Learning Experience Pulse',
    description: 'A sample survey covering the course experience and all core answer shapes.',
    status: 'PUBLISHED',
    questions: [
      {
        id: 4101,
        prompt: 'Which learning activities helped you most?',
        questionType: 'MULTI_CHOICE',
        isRequired: true,
        minSelections: 1,
        maxSelections: 2,
        options: ['Lectures', 'Lab exercises', 'Peer discussion', 'Reading materials'],
      },
      {
        id: 4102,
        prompt: 'Which topic would you like us to explain again?',
        questionType: 'LONG_TEXT',
        isRequired: false,
      },
      {
        id: 4103,
        prompt: 'I feel confident applying the software engineering practices from class.',
        questionType: 'LIKERT',
        isRequired: true,
        options: likertOptions,
      },
      {
        id: 4104,
        prompt: 'How helpful has the course been so far?',
        questionType: 'RATING',
        isRequired: true,
        numberMin: 1,
        numberMax: 5,
      },
      {
        id: 4105,
        prompt: 'When did you last review the course materials?',
        questionType: 'DATE',
        isRequired: false,
      },
    ],
  },
  {
    id: 5,
    ownerEmail: 'owner2@survey.local',
    title: 'Campus Services Pulse',
    description: 'A sample survey about campus resources and study time.',
    status: 'PUBLISHED',
    questions: [
      {
        id: 5101,
        prompt: 'Did you use the campus library this week?',
        questionType: 'YES_NO',
        isRequired: true,
        options: ['Yes', 'No'],
      },
      {
        id: 5102,
        prompt: 'How many hours did you study on campus this week?',
        questionType: 'INTEGER',
        isRequired: true,
        numberMin: 0,
        numberMax: 60,
      },
      {
        id: 5103,
        prompt: 'Which campus service did you use most?',
        questionType: 'SINGLE_CHOICE',
        isRequired: true,
        options: ['Library', 'Computer lab', 'Tutoring center'],
      },
      {
        id: 5104,
        prompt: 'What would improve your study environment?',
        questionType: 'SHORT_TEXT',
        isRequired: false,
      },
    ],
  },
  {
    id: 6,
    ownerEmail: 'owner1@survey.local',
    title: 'Team Project Retrospective',
    description: 'A draft survey for a team reflection session.',
    status: 'DRAFT',
    questions: [
      {
        id: 6101,
        prompt: 'How clear were the project requirements?',
        questionType: 'RATING',
        isRequired: true,
        numberMin: 1,
        numberMax: 5,
      },
      {
        id: 6102,
        prompt: 'Which collaboration practices should the team keep?',
        questionType: 'MULTI_CHOICE',
        isRequired: true,
        minSelections: 1,
        maxSelections: 3,
        options: ['Daily check-ins', 'Shared task board', 'Code reviews', 'Pair programming'],
      },
      {
        id: 6103,
        prompt: 'What is one change that would help the next project?',
        questionType: 'LONG_TEXT',
        isRequired: false,
      },
      {
        id: 6104,
        prompt: 'How many team meetings did you attend?',
        questionType: 'INTEGER',
        isRequired: false,
        numberMin: 0,
        numberMax: 30,
      },
    ],
  },
  {
    id: 7,
    ownerEmail: 'owner2@survey.local',
    title: 'Study Habits Check-in',
    description: 'A draft survey with date, agreement, yes/no, and short-text questions.',
    status: 'DRAFT',
    questions: [
      {
        id: 7101,
        prompt: 'On what date did you begin your current study plan?',
        questionType: 'DATE',
        isRequired: false,
      },
      {
        id: 7102,
        prompt: 'I can keep up with my weekly study plan.',
        questionType: 'LIKERT',
        isRequired: true,
        options: likertOptions,
      },
      {
        id: 7103,
        prompt: 'Do you usually review your notes within one day of class?',
        questionType: 'YES_NO',
        isRequired: true,
        options: ['Yes', 'No'],
      },
      {
        id: 7104,
        prompt: 'What study habit works best for you?',
        questionType: 'SHORT_TEXT',
        isRequired: false,
      },
    ],
  },
];

async function main() {
  assertShowcaseDatabaseTarget();
  const { PrismaClient, Role } = require('@prisma/client');
  const prisma = new PrismaClient();
  const publishedAt = new Date('2026-11-28T00:00:00.000Z');

  try {
    await prisma.$transaction(async (tx) => {
      for (const survey of surveys) {
        const owner = await tx.user.findUnique({ where: { email: survey.ownerEmail } });
        if (!owner || owner.role !== Role.SURVEY_OWNER) {
          throw new Error(`Missing seeded survey owner: ${survey.ownerEmail}. Run the regular local seed first.`);
        }

        await tx.survey.upsert({
          where: { id: id(survey.id) },
          update: {},
          create: {
            id: id(survey.id),
            title: survey.title,
            description: survey.description,
            status: survey.status,
            mode: 'IDENTIFIED',
            ownerId: owner.id,
            publishedAt: survey.status === 'PUBLISHED' ? publishedAt : null,
            questions: {
              create: survey.questions.map((question, orderIndex) => ({
                id: id(question.id),
                prompt: question.prompt,
                questionType: question.questionType,
                isRequired: question.isRequired,
                orderIndex,
                ...(question.minSelections !== undefined ? {
                  minSelections: question.minSelections,
                  maxSelections: question.maxSelections,
                } : {}),
                ...(question.numberMin !== undefined ? {
                  numberMin: question.numberMin,
                  numberMax: question.numberMax,
                } : {}),
                ...(question.options ? {
                  options: {
                    create: question.options.map((label, optionIndex) => ({
                      id: id(question.id * 100 + optionIndex + 1),
                      label,
                      orderIndex: optionIndex,
                    })),
                  },
                } : {}),
              })),
            },
          },
        });
      }
    });

    const questionCount = surveys.reduce((sum, survey) => sum + survey.questions.length, 0);
    console.log(`Ensured ${surveys.length} showcase surveys with ${questionCount} questions.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Showcase seed failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
