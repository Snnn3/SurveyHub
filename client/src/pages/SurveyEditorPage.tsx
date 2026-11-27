import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { getApiErrorMessage, getApiErrorStatus, parseApiError, type ApiErrorDetail } from '../api';
import { ConfirmationModal } from '../components/ConfirmationModal';
import type { SurveyMode } from '../types/survey';

export type QuestionType =
  | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'SHORT_TEXT' | 'LONG_TEXT'
  | 'YES_NO' | 'LIKERT' | 'RATING' | 'INTEGER' | 'DATE';

const fixedOptions: Partial<Record<QuestionType, string[]>> = {
  YES_NO: ['Yes', 'No'],
  LIKERT: ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree'],
};

export interface FormOption {
  label: string;
}

export interface FormQuestion {
  prompt: string;
  questionType: QuestionType;
  isRequired: boolean;
  options: FormOption[];
  minSelections?: number;
  maxSelections?: number;
  numberMin?: number;
  numberMax?: number;
}

interface SurveyEditorDetail {
  id: string;
  title: string;
  description: string | null;
  mode: SurveyMode;
  status: string;
  questions: Array<{
    prompt: string;
    questionType: QuestionType;
    isRequired: boolean;
    options: Array<{ label: string }>;
    minSelections?: number | null;
    maxSelections?: number | null;
    numberMin?: number | null;
    numberMax?: number | null;
  }>;
}

export const fieldKey = {
  title: 'survey-title',
  description: 'survey-desc',
  prompt: (qIndex: number) => `prompt-${qIndex}`,
  options: (qIndex: number) => `options-${qIndex}`,
  bounds: (qIndex: number) => `bounds-${qIndex}`,
  option: (qIndex: number, optIndex: number) => `option-${qIndex}-${optIndex}`,
  addQuestionBtn: 'add-question-btn',
};

function swapItems<T>(items: T[], index: number, direction: 'up' | 'down'): T[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const copy = [...items];
  const temp = copy[index];
  copy[index] = copy[targetIndex];
  copy[targetIndex] = temp;
  return copy;
}

function applyServerValidationErrors(
  details: ApiErrorDetail[],
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  setValidationErrors: React.Dispatch<React.SetStateAction<string[]>>
) {
  if (details.length === 0) return;
  const newFieldErrors: Record<string, string> = {};
  const detailMessages: string[] = [];

  details.forEach((d) => {
    detailMessages.push(d.message);
    if (d.field) {
      let domField = d.field;
      if (domField === 'title') domField = fieldKey.title;
      else if (domField === 'description') domField = fieldKey.description;
      else if (domField === 'questions') domField = fieldKey.addQuestionBtn;
      else if (domField.startsWith('questions.')) {
        const parts = domField.split('.');
        const qIdx = Number(parts[1]);
        if (!isNaN(qIdx)) {
          if (parts.length === 2) {
            const isOptionError = d.code
              ? d.code.includes('OPTION')
              : d.message.toLowerCase().includes('option');
            domField = isOptionError
              ? fieldKey.options(qIdx)
              : fieldKey.prompt(qIdx);
          } else if (parts[2] === 'prompt') {
            domField = fieldKey.prompt(qIdx);
          } else if (parts[2] === 'options') {
            if (parts[3] !== undefined) {
              const optIdx = Number(parts[3]);
              domField = !isNaN(optIdx) ? fieldKey.option(qIdx, optIdx) : fieldKey.options(qIdx);
            } else {
              domField = fieldKey.options(qIdx);
            }
          } else if (['minSelections', 'maxSelections', 'numberMin', 'numberMax'].includes(parts[2])) {
            domField = fieldKey.bounds(qIdx);
          }
        }
      }
      newFieldErrors[domField] = d.message;
    }
  });

  if (detailMessages.length > 0) {
    setValidationErrors(detailMessages);
  }
  if (Object.keys(newFieldErrors).length > 0) {
    setFieldErrors(newFieldErrors);
    const firstId = Object.keys(newFieldErrors)[0];
    document.getElementById(firstId)?.focus();
  }
}

export function SurveyEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [surveyId, setSurveyId] = useState<string | undefined>(id);
  const isEditing = Boolean(surveyId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<SurveyMode>('IDENTIFIED');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  const [loading, setLoading] = useState(Boolean(id));
  const [loadErrorCode, setLoadErrorCode] = useState<400 | 403 | 404 | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [questionIndexToDelete, setQuestionIndexToDelete] = useState<number | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReloadConfirm, setShowReloadConfirm] = useState(false);
  const [reloading, setReloading] = useState(false);

  function applySurveyDetail(survey: SurveyEditorDetail) {
    setTitle(survey.title);
    setDescription(survey.description || '');
    setMode(survey.mode);
    setQuestions(survey.questions.map((question) => ({
      prompt: question.prompt,
      questionType: question.questionType,
      isRequired: question.isRequired,
      options: question.options.map((option) => ({ label: option.label })),
      minSelections: question.minSelections ?? undefined,
      maxSelections: question.maxSelections ?? undefined,
      numberMin: question.numberMin ?? undefined,
      numberMax: question.numberMax ?? undefined,
    })));
  }

  function clearFieldError(fieldId: string) {
    setFieldErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const copy = { ...prev };
      delete copy[fieldId];
      return copy;
    });
  }

  function showAccessDenied() {
    setTitle('');
    setDescription('');
    setQuestions([]);
    setError(null);
    setShowReloadConfirm(false);
    setLoadErrorCode(403);
  }

  useEffect(() => {
    if (!id) return;

    let active = true;
    async function loadSurvey() {
      try {
        const res = await api.get<{ data: SurveyEditorDetail }>(`/surveys/${id}`);

        if (!active) return;
        const survey = res.data.data;
        if (survey.status !== 'DRAFT') {
          setError('Only draft surveys can be edited.');
          setLoadErrorCode(400);
          return;
        }

        applySurveyDetail(survey);
      } catch (err: unknown) {
        if (!active) return;
        const status = getApiErrorStatus(err);
        if (status === 404 || status === 403) {
          setLoadErrorCode(status);
          return;
        }
        setError(getApiErrorMessage(err, 'Failed to load survey.'));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSurvey();
    return () => {
      active = false;
    };
  }, [id]);

  function validateForPublish(): { errors: string[]; fieldErrors: Record<string, string> } {
    const errors: string[] = [];
    const fields: Record<string, string> = {};

    if (!title.trim()) {
      errors.push('Survey title is required.');
      fields[fieldKey.title] = 'Survey title is required.';
    } else if (title.trim().length > 120) {
      errors.push('Survey title must be at most 120 characters.');
      fields[fieldKey.title] = 'Survey title must be at most 120 characters.';
    }

    if (description.trim().length > 2000) {
      errors.push('Description must be at most 2,000 characters.');
      fields[fieldKey.description] = 'Description must be at most 2,000 characters.';
    }

    if (questions.length === 0) {
      errors.push('Survey must contain at least one question to be published.');
      fields[fieldKey.addQuestionBtn] = 'Survey must contain at least one question.';
      return { errors, fieldErrors: fields };
    }

    questions.forEach((question, qIndex) => {
      const qNum = qIndex + 1;
      const promptKey = fieldKey.prompt(qIndex);

      if (!question.prompt.trim()) {
        errors.push(`Question ${qNum}: Prompt cannot be empty.`);
        fields[promptKey] = 'Prompt cannot be empty.';
      } else if (question.prompt.trim().length > 500) {
        errors.push(`Question ${qNum}: Prompt must be at most 500 characters.`);
        fields[promptKey] = 'Prompt must be at most 500 characters.';
      }

      if (question.questionType === 'SINGLE_CHOICE' || question.questionType === 'MULTI_CHOICE') {
        const optionsKey = fieldKey.options(qIndex);
        if (question.options.length < 2) {
          errors.push(`Question ${qNum}: Choice questions must have at least 2 options.`);
          fields[optionsKey] = 'Choice questions must have at least 2 options.';
        } else if (question.options.length > 20) {
          errors.push(`Question ${qNum}: Choice questions cannot exceed 20 options.`);
          fields[optionsKey] = 'Choice questions cannot exceed 20 options.';
        }

        const labels: string[] = [];
        question.options.forEach((opt, optIndex) => {
          const optKey = fieldKey.option(qIndex, optIndex);
          const trimmed = opt.label.trim();
          if (!trimmed) {
            errors.push(`Question ${qNum}: Option ${optIndex + 1} cannot be empty.`);
            fields[optKey] = 'Option label cannot be empty.';
          } else if (trimmed.length > 200) {
            errors.push(`Question ${qNum}: Option ${optIndex + 1} must be at most 200 characters.`);
            fields[optKey] = 'Option label must be at most 200 characters.';
            labels.push(trimmed.toLowerCase());
          } else {
            labels.push(trimmed.toLowerCase());
          }
        });

        if (new Set(labels).size !== labels.length && !fields[optionsKey]) {
          errors.push(`Question ${qNum}: Option labels must be unique.`);
          fields[optionsKey] = 'Option labels must be unique within each question.';
        }

        if (question.questionType === 'MULTI_CHOICE' &&
          (!Number.isInteger(question.minSelections) || !Number.isInteger(question.maxSelections) ||
           (question.minSelections ?? 0) < 1 || (question.maxSelections ?? 0) < (question.minSelections ?? 0) ||
           (question.maxSelections ?? 0) > question.options.length)) {
          errors.push(`Question ${qNum}: Choose a valid minimum and maximum selection count.`);
          fields[fieldKey.bounds(qIndex)] = 'Use whole numbers where 1 ≤ minimum ≤ maximum ≤ option count.';
        }
      }

      if (question.questionType === 'INTEGER' && question.numberMin !== undefined && question.numberMax !== undefined && question.numberMin > question.numberMax) {
        errors.push(`Question ${qNum}: Minimum must not exceed maximum.`);
        fields[fieldKey.bounds(qIndex)] = 'Minimum must be less than or equal to maximum.';
      }
    });

    return { errors, fieldErrors: fields };
  }

  function addQuestion(type: QuestionType = 'SINGLE_CHOICE') {
    setQuestions((prev) => [
      ...prev,
      {
        prompt: '',
        questionType: type,
        isRequired: true,
        options: type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE' ? [{ label: '' }, { label: '' }] : [],
        ...(type === 'MULTI_CHOICE' ? { minSelections: 1, maxSelections: 2 } : {}),
      },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    setQuestionIndexToDelete(null);
    setFieldErrors({});
    setValidationErrors([]);
  }

  function moveQuestion(index: number, direction: 'up' | 'down') {
    setQuestions((prev) => swapItems(prev, index, direction));
    setFieldErrors({});
    setValidationErrors([]);
  }

  function updateQuestion(index: number, patch: Partial<FormQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  }

  function updateQuestionOptions(
    questionIndex: number,
    updater: (options: FormOption[]) => FormOption[]
  ) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === questionIndex ? { ...q, options: updater(q.options) } : q))
    );
  }

  function addOption(questionIndex: number) {
    updateQuestionOptions(questionIndex, (options) =>
      options.length >= 20 ? options : [...options, { label: '' }]
    );
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    updateQuestionOptions(questionIndex, (options) =>
      options.filter((_, optIdx) => optIdx !== optionIndex)
    );
    setFieldErrors({});
    setValidationErrors([]);
  }

  function updateOption(questionIndex: number, optionIndex: number, label: string) {
    updateQuestionOptions(questionIndex, (options) => {
      const copy = [...options];
      copy[optionIndex] = { label };
      return copy;
    });
  }

  function moveOption(questionIndex: number, optionIndex: number, direction: 'up' | 'down') {
    updateQuestionOptions(questionIndex, (options) => swapItems(options, optionIndex, direction));
    setFieldErrors({});
    setValidationErrors([]);
  }

  async function handleSaveDraft(): Promise<string | null> {
    if (!title.trim()) {
      setFieldErrors({ [fieldKey.title]: 'Survey title is required.' });
      document.getElementById(fieldKey.title)?.focus();
      return null;
    }
    if (title.trim().length > 120) {
      setFieldErrors({ [fieldKey.title]: 'Survey title must be at most 120 characters.' });
      document.getElementById(fieldKey.title)?.focus();
      return null;
    }
    if (description.trim().length > 2000) {
      setFieldErrors({ [fieldKey.description]: 'Description must be at most 2,000 characters.' });
      document.getElementById(fieldKey.description)?.focus();
      return null;
    }

    setSaving(true);
    setError(null);
    setValidationErrors([]);
    setFieldErrors({});

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      mode,
      questions: questions.map((q) => ({
        prompt: q.prompt.trim(),
        questionType: q.questionType,
        isRequired: q.isRequired,
        options: q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTI_CHOICE'
          ? q.options.map((opt) => ({ label: opt.label.trim() }))
          : [],
        ...(q.questionType === 'MULTI_CHOICE' ? { minSelections: q.minSelections, maxSelections: q.maxSelections } : {}),
        ...(q.questionType === 'INTEGER' ? { numberMin: q.numberMin, numberMax: q.numberMax } : {}),
      })),
    };

    try {
      if (surveyId) {
        const response = await api.put<{ data: SurveyEditorDetail }>(`/surveys/${surveyId}`, payload);
        applySurveyDetail(response.data.data);
        return surveyId;
      } else {
        const res = await api.post<{ data: SurveyEditorDetail }>('/surveys', payload);
        const newId = res.data.data.id;
        applySurveyDetail(res.data.data);
        setSurveyId(newId);
        navigate(`/owner/surveys/${newId}/edit`, { replace: true });
        return newId;
      }
    } catch (err: unknown) {
      if (getApiErrorStatus(err) === 403) {
        showAccessDenied();
        return null;
      }
      const errInfo = parseApiError(err, 'Failed to save survey.');
      setError(errInfo.message);
      applyServerValidationErrors(errInfo.details, setFieldErrors, setValidationErrors);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function reloadSavedDraft() {
    if (!surveyId) return;
    setReloading(true);
    setError(null);
    try {
      const response = await api.get<{ data: SurveyEditorDetail }>(`/surveys/${surveyId}`);
      const saved = response.data.data;
      if (saved.status !== 'DRAFT') throw new Error('Only draft surveys can be edited.');
      applySurveyDetail(saved);
      setFieldErrors({});
      setValidationErrors([]);
      setShowReloadConfirm(false);
    } catch (err: unknown) {
      if (getApiErrorStatus(err) === 403) {
        showAccessDenied();
      } else {
        setError(getApiErrorMessage(err, 'Failed to reload the saved draft.'));
        setShowReloadConfirm(false);
      }
    } finally {
      setReloading(false);
    }
  }

  async function onSaveDraftClick() {
    const savedId = await handleSaveDraft();
    if (savedId) {
      navigate('/owner/surveys', { state: { successMessage: 'Draft survey saved successfully.' } });
    }
  }

  async function onPublishClick() {
    if (mode === 'ANONYMOUS') {
      setError('Anonymous surveys are not available yet. Choose Identified to publish this survey.');
      return;
    }

    const { errors, fieldErrors: validationFieldErrors } = validateForPublish();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setFieldErrors(validationFieldErrors);

      const firstFieldId = Object.keys(validationFieldErrors)[0];
      if (firstFieldId) {
        const el = document.getElementById(firstFieldId);
        if (el) {
          el.focus();
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setValidationErrors([]);
    setFieldErrors({});
    const savedId = await handleSaveDraft();
    if (!savedId) return;

    setSaving(true);
    try {
      await api.patch(`/surveys/${savedId}/publish`);
      navigate('/owner/surveys', { state: { successMessage: 'Survey published successfully.' } });
    } catch (err: unknown) {
      if (getApiErrorStatus(err) === 403) {
        showAccessDenied();
      } else {
        const errInfo = parseApiError(err, 'Publishing failed.');
        setError(errInfo.message);
        applyServerValidationErrors(errInfo.details, setFieldErrors, setValidationErrors);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loadErrorCode) {
    let title = 'Survey Not Editable';
    let msg = 'Only draft surveys can be edited.';
    if (loadErrorCode === 404) {
      title = 'Survey Not Found';
      msg = 'The survey you are looking for does not exist or has been removed.';
    } else if (loadErrorCode === 403) {
      title = 'Access Denied';
      msg = 'Access denied';
    }
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center max-w-lg mx-auto space-y-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{msg}</p>
        <Link
          to="/owner/surveys"
          className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Return to My Surveys
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center max-w-3xl mx-auto space-y-4"
        role="status"
        aria-live="polite"
      >
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-600">Loading survey editor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isEditing ? 'Edit Draft Survey' : 'Create New Survey'}
          </h2>
          <p className="text-sm text-slate-600">Configure survey metadata and questions.</p>
        </div>
        {surveyId && <button
          type="button"
          onClick={() => setShowReloadConfirm(true)}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >Reload saved draft</button>}
        <button
          type="button"
          onClick={() => setShowCloseConfirm(true)}
          className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          Close Editor
        </button>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1"
        >
          <p className="font-semibold">Survey structure must be completed before publishing:</p>
          <ul className="list-disc pl-5 space-y-0.5 text-xs">
            {validationErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Survey Metadata Form */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <label htmlFor="survey-title" className="block text-sm font-semibold text-slate-800 mb-1">
            Survey Title <span className="text-red-500">*</span>
          </label>
          <input
            id="survey-title"
            type="text"
            required
            maxLength={120}
            aria-invalid={Boolean(fieldErrors['survey-title'])}
            aria-describedby={fieldErrors['survey-title'] ? 'survey-title-error' : undefined}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearFieldError('survey-title');
            }}
            placeholder="e.g., CPE 334 Midterm Feedback"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {fieldErrors['survey-title'] && (
            <p id="survey-title-error" role="alert" className="text-xs text-red-600 mt-1">
              {fieldErrors['survey-title']}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1 text-right">{title.length} / 120 characters</p>
        </div>

        <div>
          <label htmlFor="survey-desc" className="block text-sm font-semibold text-slate-800 mb-1">
            Description <span className="text-xs font-normal text-slate-500">(Optional)</span>
          </label>
          <textarea
            id="survey-desc"
            rows={3}
            maxLength={2000}
            aria-invalid={Boolean(fieldErrors['survey-desc'])}
            aria-describedby={fieldErrors['survey-desc'] ? 'survey-desc-error' : undefined}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clearFieldError('survey-desc');
            }}
            placeholder="Provide context or instructions for respondents..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {fieldErrors['survey-desc'] && (
            <p id="survey-desc-error" role="alert" className="text-xs text-red-600 mt-1">
              {fieldErrors['survey-desc']}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1 text-right">{description.length} / 2,000 characters</p>
        </div>

        <div>
          <label htmlFor="survey-mode" className="block text-sm font-semibold text-slate-800 mb-1">
            Response privacy
          </label>
          <select
            id="survey-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as SurveyMode)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="IDENTIFIED">Identified</option>
            <option value="ANONYMOUS">Anonymous</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'ANONYMOUS'
              ? 'Anonymous receipts show submission metadata only, and a claim prevents the same account from submitting twice. Anonymous drafts can be saved, but cannot be published until response support is ready.'
              : 'Identified responses include a receipt with the respondent’s answers.'}
          </p>
        </div>
      </section>

      {/* Dynamic Questions List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Questions ({questions.length})</h3>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              id="add-question-btn"
              type="button"
              onClick={() => addQuestion('SINGLE_CHOICE')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
            >
              + Single Choice
            </button>
            <button
              type="button"
              onClick={() => addQuestion('SHORT_TEXT')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
            >
              + Short Text
            </button>
            <select
              aria-label="Additional question type"
              value=""
              onChange={(event) => {
                if (event.target.value) addQuestion(event.target.value as QuestionType);
              }}
              className="rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xs text-indigo-700"
            >
              <option value="">More types…</option>
              <option value="MULTI_CHOICE">Multi Choice</option>
              <option value="LONG_TEXT">Long Text</option>
              <option value="YES_NO">Yes / No</option>
              <option value="LIKERT">Likert</option>
              <option value="RATING">Rating</option>
              <option value="INTEGER">Integer</option>
              <option value="DATE">Date</option>
            </select>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            <p>No questions added yet. Add at least one question to publish this survey.</p>
            {fieldErrors[fieldKey.addQuestionBtn] && (
              <p role="alert" className="text-xs text-red-600 mt-2 font-medium">
                {fieldErrors[fieldKey.addQuestionBtn]}
              </p>
            )}
          </div>
        ) : (
          questions.map((question, qIndex) => (
            <div
              key={qIndex}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">Question {qIndex + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Move up"
                    aria-label={`Move Question ${qIndex + 1} up`}
                    disabled={qIndex === 0}
                    onClick={() => moveQuestion(qIndex, 'up')}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    aria-label={`Move Question ${qIndex + 1} down`}
                    disabled={qIndex === questions.length - 1}
                    onClick={() => moveQuestion(qIndex, 'down')}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    title="Remove question"
                    aria-label={`Remove Question ${qIndex + 1}`}
                    onClick={() => setQuestionIndexToDelete(qIndex)}
                    className="p-1 text-red-400 hover:text-red-700 ml-2 text-sm leading-none"
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
              </div>

              {/* Prompt with explicit label htmlFor */}
              <div>
                <label
                  htmlFor={`prompt-${qIndex}`}
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Prompt <span className="text-red-500">*</span>
                </label>
                <input
                  id={`prompt-${qIndex}`}
                  type="text"
                  maxLength={500}
                  aria-invalid={Boolean(fieldErrors[`prompt-${qIndex}`])}
                  aria-describedby={fieldErrors[`prompt-${qIndex}`] ? `prompt-${qIndex}-error` : undefined}
                  value={question.prompt}
                  onChange={(e) => {
                    updateQuestion(qIndex, { prompt: e.target.value });
                    clearFieldError(`prompt-${qIndex}`);
                  }}
                  placeholder="e.g. How satisfied are you with the course?"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                {fieldErrors[`prompt-${qIndex}`] && (
                  <p id={`prompt-${qIndex}-error`} role="alert" className="text-xs text-red-600 mt-1">
                    {fieldErrors[`prompt-${qIndex}`]}
                  </p>
                )}
              </div>

              {/* Type and Required Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-3">
                  <label htmlFor={`type-${qIndex}`} className="text-xs font-medium text-slate-700">Type:</label>
                  <select
                    id={`type-${qIndex}`}
                    value={question.questionType}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      const hasOptions = newType === 'SINGLE_CHOICE' || newType === 'MULTI_CHOICE';
                      const options = hasOptions
                        ? (question.questionType === 'SINGLE_CHOICE' || question.questionType === 'MULTI_CHOICE')
                          ? question.options
                          : [{ label: '' }, { label: '' }]
                        : [];
                      updateQuestion(qIndex, {
                        questionType: newType,
                        options,
                        minSelections: newType === 'MULTI_CHOICE'
                          ? question.questionType === 'MULTI_CHOICE' ? question.minSelections : 1
                          : undefined,
                        maxSelections: newType === 'MULTI_CHOICE'
                          ? question.questionType === 'MULTI_CHOICE' ? question.maxSelections : options.length
                          : undefined,
                        numberMin: newType === 'INTEGER' ? question.numberMin : undefined,
                        numberMax: newType === 'INTEGER' ? question.numberMax : undefined,
                      });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="SINGLE_CHOICE">Single Choice</option>
                    <option value="MULTI_CHOICE">Multi Choice</option>
                    <option value="SHORT_TEXT">Short Text</option>
                    <option value="LONG_TEXT">Long Text</option>
                    <option value="YES_NO">Yes / No</option>
                    <option value="LIKERT">Likert</option>
                    <option value="RATING">Rating</option>
                    <option value="INTEGER">Integer</option>
                    <option value="DATE">Date</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={question.isRequired}
                    onChange={(e) => updateQuestion(qIndex, { isRequired: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  Required response
                </label>
              </div>

              {(question.questionType === 'SINGLE_CHOICE' || question.questionType === 'MULTI_CHOICE') && (
                <div
                  id={`options-${qIndex}`}
                  tabIndex={-1}
                  aria-invalid={Boolean(fieldErrors[`options-${qIndex}`])}
                  aria-describedby={fieldErrors[`options-${qIndex}`] ? `options-${qIndex}-error` : undefined}
                  className="space-y-2 pt-2 border-t border-slate-100 outline-none"
                >
                  <label className="block text-xs font-semibold text-slate-700">
                    Options (2–20)
                  </label>
                  {fieldErrors[`options-${qIndex}`] && (
                    <p id={`options-${qIndex}-error`} role="alert" className="text-xs text-red-600">
                      {fieldErrors[`options-${qIndex}`]}
                    </p>
                  )}
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`option-${qIndex}-${optIndex}`}
                          className="text-xs font-medium text-slate-500 whitespace-nowrap cursor-pointer"
                        >
                          Option {optIndex + 1}:
                        </label>
                        <input
                          id={`option-${qIndex}-${optIndex}`}
                          aria-label={`Question ${qIndex + 1} Option ${optIndex + 1}`}
                          type="text"
                          maxLength={200}
                          aria-invalid={Boolean(fieldErrors[`option-${qIndex}-${optIndex}`])}
                          aria-describedby={
                            fieldErrors[`option-${qIndex}-${optIndex}`]
                              ? `option-${qIndex}-${optIndex}-error`
                              : undefined
                          }
                          value={option.label}
                          onChange={(e) => {
                            updateOption(qIndex, optIndex, e.target.value);
                            clearFieldError(`option-${qIndex}-${optIndex}`);
                          }}
                          placeholder={`Option ${optIndex + 1}`}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                        />
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            title="Move option up"
                            aria-label={`Move Question ${qIndex + 1} Option ${optIndex + 1} up`}
                            disabled={optIndex === 0}
                            onClick={() => moveOption(qIndex, optIndex, 'up')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="Move option down"
                            aria-label={`Move Question ${qIndex + 1} Option ${optIndex + 1} down`}
                            disabled={optIndex === question.options.length - 1}
                            onClick={() => moveOption(qIndex, optIndex, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 text-xs"
                          >
                            ↓
                          </button>
                          {question.options.length > 2 && (
                            <button
                              type="button"
                              aria-label={`Remove option ${optIndex + 1}`}
                              onClick={() => removeOption(qIndex, optIndex)}
                              className="text-slate-400 hover:text-red-600 text-xs p-1 ml-0.5 leading-none"
                            >
                              <span aria-hidden="true">&times;</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {fieldErrors[`option-${qIndex}-${optIndex}`] && (
                        <p
                          id={`option-${qIndex}-${optIndex}-error`}
                          role="alert"
                          className="text-xs text-red-600 pl-7"
                        >
                          {fieldErrors[`option-${qIndex}-${optIndex}`]}
                        </p>
                      )}
                    </div>
                  ))}

                  {question.options.length < 20 && (
                    <button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold mt-1"
                    >
                      + Add Option
                    </button>
                  )}
                </div>
              )}
              {question.questionType === 'MULTI_CHOICE' && (
                <div id={`bounds-${qIndex}`} className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-slate-700">
                    Minimum selections
                    <input
                      type="number" min={1} max={question.options.length} step={1}
                      value={question.minSelections ?? ''}
                      onChange={(event) => updateQuestion(qIndex, { minSelections: event.target.value === '' ? undefined : Number(event.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Maximum selections
                    <input
                      type="number" min={question.minSelections ?? 1} max={question.options.length} step={1}
                      value={question.maxSelections ?? ''}
                      onChange={(event) => updateQuestion(qIndex, { maxSelections: event.target.value === '' ? undefined : Number(event.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  {fieldErrors[fieldKey.bounds(qIndex)] && <p role="alert" className="col-span-2 text-xs text-red-600">{fieldErrors[fieldKey.bounds(qIndex)]}</p>}
                </div>
              )}
              {fixedOptions[question.questionType] && (
                <fieldset className="space-y-2 border-t border-slate-100 pt-3">
                  <legend className="text-xs font-semibold text-slate-700">Fixed options</legend>
                  {fixedOptions[question.questionType]!.map((label) => <p key={label} className="text-xs text-slate-600">{label}</p>)}
                </fieldset>
              )}
              {question.questionType === 'INTEGER' && (
                <div id={`bounds-${qIndex}`} className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-slate-700">
                    Minimum value (optional)
                    <input type="number" step={1} value={question.numberMin ?? ''}
                      onChange={(event) => updateQuestion(qIndex, { numberMin: event.target.value === '' ? undefined : Number(event.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Maximum value (optional)
                    <input type="number" step={1} value={question.numberMax ?? ''}
                      onChange={(event) => updateQuestion(qIndex, { numberMax: event.target.value === '' ? undefined : Number(event.target.value) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  {fieldErrors[fieldKey.bounds(qIndex)] && <p role="alert" className="col-span-2 text-xs text-red-600">{fieldErrors[fieldKey.bounds(qIndex)]}</p>}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setShowCloseConfirm(true)}
          className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-center"
        >
          Close
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSaveDraftClick}
          className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg border border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onPublishClick}
          className="w-full sm:w-auto px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
        >
          {saving ? 'Processing...' : 'Publish Survey'}
        </button>
      </div>

      {/* Confirmation Dialog for Closing Editor */}
      {showCloseConfirm && (
        <ConfirmationModal
          title="Close Survey Editor"
          message="Are you sure you want to exit? Any unsaved changes will be lost."
          cancelLabel="Keep Editing"
          confirmLabel="Discard & Close"
          variant="neutral"
          onCancel={() => setShowCloseConfirm(false)}
          onConfirm={() => navigate('/owner/surveys')}
        />
      )}

      {showReloadConfirm && (
        <ConfirmationModal
          title="Reload saved draft"
          message="Discard your unsaved editor changes and reload the last saved draft?"
          cancelLabel="Keep editing"
          confirmLabel="Discard and reload"
          variant="warning"
          processing={reloading}
          onCancel={() => setShowReloadConfirm(false)}
          onConfirm={() => { void reloadSavedDraft(); }}
        />
      )}

      {/* Confirmation Dialog for Question Removal */}
      {questionIndexToDelete !== null && (
        <ConfirmationModal
          title="Remove Question"
          message={`Are you sure you want to remove Question ${questionIndexToDelete + 1}? This action cannot be undone.`}
          confirmLabel="Remove"
          variant="danger"
          onCancel={() => setQuestionIndexToDelete(null)}
          onConfirm={() => removeQuestion(questionIndexToDelete)}
        />
      )}
    </div>
  );
}
