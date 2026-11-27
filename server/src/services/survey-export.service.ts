import { QuestionType, SurveyMode } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { serializeCsv, type CsvCell } from '../utils/csv-export';
import { NotFoundError } from '../utils/errors';
import { getNumberStats } from '../utils/number-stats';
import { getAuthorizedSurvey } from './survey.service';

const identifiedHeader = [
  'survey_id', 'survey_title', 'response_id', 'submitted_at', 'respondent_id', 'respondent_full_name',
  'respondent_email', 'question_id', 'question_order', 'question_prompt', 'question_type', 'text_value',
  'number_value', 'date_value', 'selected_options_json',
];

const aggregateHeader = [
  'survey_id', 'survey_title', 'question_id', 'question_order', 'question_prompt', 'question_type', 'metric',
  'bucket_value', 'count', 'answered_count', 'total_responses', 'percentage', 'average', 'minimum', 'maximum',
];

const optionQuestionTypes = new Set<QuestionType>([
  QuestionType.SINGLE_CHOICE,
  QuestionType.MULTI_CHOICE,
  QuestionType.YES_NO,
  QuestionType.LIKERT,
]);

const textQuestionTypes = new Set<QuestionType>([QuestionType.SHORT_TEXT, QuestionType.LONG_TEXT]);

function numericStats(values: number[]) {
  const { average, min, max } = getNumberStats(values);
  return {
    average: average ?? '',
    minimum: min ?? '',
    maximum: max ?? '',
  };
}

function aggregateRow(
  survey: { id: string; title: string; totalResponses: number },
  question: { id: string; orderIndex: number; prompt: string; questionType: QuestionType },
  metric: string,
  bucketValue: CsvCell,
  count: number,
  answeredCount: number,
  percentage: CsvCell,
  stats: ReturnType<typeof numericStats>
): CsvCell[] {
  return [
    survey.id, survey.title, question.id, question.orderIndex, question.prompt, question.questionType,
    metric, bucketValue, count, answeredCount, survey.totalResponses, percentage,
    stats.average, stats.minimum, stats.maximum,
  ];
}

async function identifiedCsv(surveyId: string): Promise<string> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId, mode: SurveyMode.IDENTIFIED },
    select: {
      id: true,
      title: true,
      questions: {
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          prompt: true,
          questionType: true,
          orderIndex: true,
          options: {
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            select: { id: true, label: true },
          },
        },
      },
      responses: {
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          submittedAt: true,
          respondent: { select: { id: true, fullName: true, email: true } },
          answers: {
            select: {
              questionId: true,
              textValue: true,
              numberValue: true,
              dateValue: true,
              selectedOptions: { select: { optionId: true } },
            },
          },
        },
      },
    },
  });

  if (!survey) throw new NotFoundError('Survey not found.');

  const rows: CsvCell[][] = [identifiedHeader];
  for (const response of survey.responses) {
    const answers = new Map(response.answers.map((answer) => [answer.questionId, answer]));
    for (const question of survey.questions) {
      const answer = answers.get(question.id);
      const selectedIds = new Set(answer?.selectedOptions.map((item) => item.optionId) ?? []);
      const selectedOptions = question.options
        .filter((option) => selectedIds.has(option.id))
        .map(({ id: optionId, label }) => ({ optionId, label }));
      const isText = textQuestionTypes.has(question.questionType);
      const isNumber = question.questionType === QuestionType.RATING || question.questionType === QuestionType.INTEGER;
      const isDate = question.questionType === QuestionType.DATE;

      rows.push([
        survey.id,
        survey.title,
        response.id,
        response.submittedAt.toISOString(),
        response.respondent?.id ?? '',
        response.respondent?.fullName ?? '',
        response.respondent?.email ?? '',
        question.id,
        question.orderIndex,
        question.prompt,
        question.questionType,
        isText ? answer?.textValue ?? '' : '',
        isNumber ? answer?.numberValue ?? '' : '',
        isDate && answer?.dateValue ? { value: answer.dateValue.toISOString().slice(0, 10), text: false } : '',
        optionQuestionTypes.has(question.questionType) ? JSON.stringify(selectedOptions) : '',
      ]);
    }
  }

  return serializeCsv(rows);
}

async function aggregateCsv(surveyId: string): Promise<string> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId, mode: SurveyMode.ANONYMOUS },
    select: {
      id: true,
      title: true,
      _count: { select: { responses: true } },
      questions: {
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          prompt: true,
          questionType: true,
          orderIndex: true,
          options: {
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            select: { id: true, label: true },
          },
          answers: {
            select: {
              textValue: true,
              numberValue: true,
              dateValue: true,
              selectedOptions: { select: { optionId: true } },
            },
          },
        },
      },
    },
  });

  if (!survey) throw new NotFoundError('Survey not found.');
  const surveySummary = { id: survey.id, title: survey.title, totalResponses: survey._count.responses };
  const rows: CsvCell[][] = [aggregateHeader];

  for (const question of survey.questions) {
    const isOptionQuestion = optionQuestionTypes.has(question.questionType);
    const isTextQuestion = textQuestionTypes.has(question.questionType);
    const numericValues = question.answers
      .map((answer) => answer.numberValue)
      .filter((value): value is number => value !== null && Number.isInteger(value));
    const stats = question.questionType === QuestionType.INTEGER || question.questionType === QuestionType.RATING
      ? numericStats(numericValues)
      : { average: '', minimum: '', maximum: '' };

    if (question.questionType === QuestionType.RATING) {
      for (const rating of [1, 2, 3, 4, 5]) {
        const count = numericValues.filter((value) => value === rating).length;
        const percentage = numericValues.length ? Number(((count / numericValues.length) * 100).toFixed(2)) : '';
        rows.push(aggregateRow(surveySummary, question, 'count', rating, count, numericValues.length, percentage, stats));
      }
      continue;
    }

    if (isOptionQuestion) {
      const answeredCount = question.answers.filter((answer) => answer.selectedOptions.length > 0).length;
      for (const option of question.options) {
        const count = question.answers.filter((answer) =>
          answer.selectedOptions.some((selected) => selected.optionId === option.id)
        ).length;
        const percentage = answeredCount ? Number(((count / answeredCount) * 100).toFixed(2)) : '';
        rows.push(aggregateRow(surveySummary, question, 'count', option.label, count, answeredCount, percentage, stats));
      }
      continue;
    }

    if (isTextQuestion) {
      const answeredCount = question.answers.filter(
        (answer) => typeof answer.textValue === 'string' && answer.textValue.trim().length > 0
      ).length;
      rows.push(aggregateRow(surveySummary, question, 'answered_count', '', answeredCount, answeredCount, '', stats));
      continue;
    }

    if (question.questionType === QuestionType.INTEGER) {
      const counts = new Map<number, number>();
      for (const value of numericValues) counts.set(value, (counts.get(value) ?? 0) + 1);
      const buckets = counts.size ? [...counts].sort(([left], [right]) => left - right) : [[null, 0] as const];
      for (const [value, count] of buckets) {
        rows.push(aggregateRow(surveySummary, question, 'count', value, count, numericValues.length, '', stats));
      }
      continue;
    }

    if (question.questionType === QuestionType.DATE) {
      const counts = new Map<string, number>();
      for (const answer of question.answers) {
        if (!answer.dateValue) continue;
        const date = answer.dateValue.toISOString().slice(0, 10);
        counts.set(date, (counts.get(date) ?? 0) + 1);
      }
      const buckets = counts.size ? [...counts].sort(([left], [right]) => left.localeCompare(right)) : [[null, 0] as const];
      for (const [date, count] of buckets) {
        rows.push(aggregateRow(
          surveySummary,
          question,
          'count',
          date === null ? '' : { value: date, text: false },
          count,
          [...counts.values()].reduce((sum, value) => sum + value, 0),
          '',
          stats
        ));
      }
    }
  }

  return serializeCsv(rows);
}

export async function exportSurveyCsv(surveyId: string, ownerId: string): Promise<{ filename: string; csv: string }> {
  const authorized = await getAuthorizedSurvey(surveyId, ownerId);
  const survey = await prisma.survey.findUnique({ where: { id: authorized.id }, select: { id: true, mode: true } });
  if (!survey) throw new NotFoundError('Survey not found.');

  const identified = survey.mode === SurveyMode.IDENTIFIED;
  return {
    filename: `survey-${survey.id}-${identified ? 'identified' : 'aggregate'}.csv`,
    csv: identified ? await identifiedCsv(survey.id) : await aggregateCsv(survey.id),
  };
}
