import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SurveyQuestionInput, type SurveyQuestionInputModel } from '../src/components/SurveyQuestionInput';
import { toLocalDateTime } from '../src/utils/survey-schedule';
import { SurveyStartAction } from '../src/components/SurveyStartAction';

const options = [
  { id: 'option-1', label: 'First' },
  { id: 'option-2', label: 'Second' },
  { id: 'option-3', label: 'Third' },
];

function renderQuestion(
  questionType: string,
  overrides: Partial<SurveyQuestionInputModel> = {},
  answer: string | string[] | undefined = undefined,
  validationError?: string,
) {
  const question: SurveyQuestionInputModel = {
    id: 'question-1',
    questionType,
    isRequired: true,
    options,
    ...overrides,
  };

  return renderToStaticMarkup(createElement(SurveyQuestionInput, {
    question,
    answer,
    validationError,
    onChange: () => undefined,
  }));
}

test('MULTI_CHOICE renders question-owned checkboxes, current selection and bounds', () => {
  const markup = renderQuestion('MULTI_CHOICE', { minSelections: 2, maxSelections: 3 }, ['option-2'], 'Choose at least two.');

  assert.equal((markup.match(/type="checkbox"/g) ?? []).length, 3);
  assert.match(markup, /value="option-2"/);
  assert.match(markup, /checked=""/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /1 selected\. Choose 2–3 options\./);
});

test('LONG_TEXT renders its 10,000-character limit and answer counter', () => {
  const markup = renderQuestion('LONG_TEXT', {}, 'saved answer');

  assert.match(markup, /<textarea[^>]*maxLength="10000"/);
  assert.match(markup, /12\/10,000/);
  assert.match(markup, /aria-describedby="question-1-counter"/);
});

test('YES_NO renders ordered question options as required radios', () => {
  const markup = renderQuestion('YES_NO', {
    options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
  });

  assert.equal((markup.match(/type="radio"/g) ?? []).length, 2);
  assert.ok(markup.indexOf('>Yes</label>') < markup.indexOf('>No</label>'));
  assert.match(markup, /name="question-1"/);
  assert.match(markup, /value="yes"/);
  assert.match(markup, /required=""/);
});

test('LIKERT renders its ordered option labels as radios', () => {
  const markup = renderQuestion('LIKERT', {
    options: [
      { id: 'strongly-disagree', label: 'Strongly disagree' },
      { id: 'disagree', label: 'Disagree' },
      { id: 'neutral', label: 'Neutral' },
      { id: 'agree', label: 'Agree' },
      { id: 'strongly-agree', label: 'Strongly agree' },
    ],
  });

  assert.equal((markup.match(/type="radio"/g) ?? []).length, 5);
  assert.ok(markup.indexOf('Strongly disagree') < markup.indexOf('Neutral'));
  assert.ok(markup.indexOf('Neutral') < markup.indexOf('Strongly agree'));
});

test('RATING renders exactly five labeled radio values and preserves the selected value', () => {
  const markup = renderQuestion('RATING', {}, '4');

  assert.equal((markup.match(/type="radio"/g) ?? []).length, 5);
  assert.match(markup, /aria-label="Rating from 1 to 5"/);
  assert.match(markup, /checked=""/);
  assert.match(markup, /required=""/);
});

test('INTEGER renders a whole-number input with inclusive bounds', () => {
  const markup = renderQuestion('INTEGER', { numberMin: 1, numberMax: 9 }, '5');

  assert.match(markup, /type="number" step="1" min="1" max="9"/);
  assert.match(markup, /value="5"/);
  assert.match(markup, /required=""/);
});

test('DATE renders a native date input and preserves its calendar-date value', () => {
  const markup = renderQuestion('DATE', {}, '2026-11-27');

  assert.match(markup, /type="date"/);
  assert.match(markup, /value="2026-11-27"/);
  assert.match(markup, /required=""/);
});

test('scheduled-close local input preserves the same instant including milliseconds', () => {
  const instant = '2026-11-30T09:00:00.123Z';
  const localValue = toLocalDateTime(instant);

  assert.equal(new Date(localValue).getTime(), new Date(instant).getTime());
  assert.equal(toLocalDateTime(null), '');
});

test('expired published surveys disable Start and announce that responses are closed', () => {
  const markup = renderToStaticMarkup(createElement(SurveyStartAction, {
    survey: {
      id: 'survey-1', title: 'Expired', description: null, status: 'PUBLISHED',
      closesAt: '2020-01-01T00:00:00.000Z', acceptingResponses: false,
      questionCount: 1, hasSubmitted: false,
    },
  }));

  assert.match(markup, /<button[^>]*disabled=""[^>]*>Start survey<\/button>/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /This survey is no longer accepting responses\./);
});
