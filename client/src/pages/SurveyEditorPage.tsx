import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { getApiErrorMessage, getApiErrorStatus, parseApiError, type ApiErrorDetail } from '../api';
import { ConfirmationModal } from '../components/ConfirmationModal';

export type QuestionType = 'SINGLE_CHOICE' | 'SHORT_TEXT';

export interface FormOption {
  label: string;
}

export interface FormQuestion {
  prompt: string;
  questionType: QuestionType;
  isRequired: boolean;
  options: FormOption[];
}

export const fieldKey = {
  title: 'survey-title',
  description: 'survey-desc',
  prompt: (qIndex: number) => `prompt-${qIndex}`,
  options: (qIndex: number) => `options-${qIndex}`,
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
      else if (domField.startsWith('questions.')) {
        const parts = domField.split('.');
        const qIdx = Number(parts[1]);
        if (!isNaN(qIdx)) {
          if (parts.length === 2) {
            domField = d.message.toLowerCase().includes('option')
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
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  const [loading, setLoading] = useState(Boolean(id));
  const [loadErrorCode, setLoadErrorCode] = useState<400 | 403 | 404 | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [questionIndexToDelete, setQuestionIndexToDelete] = useState<number | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  function clearFieldError(fieldId: string) {
    setFieldErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const copy = { ...prev };
      delete copy[fieldId];
      return copy;
    });
  }

  useEffect(() => {
    if (!id) return;

    let active = true;
    async function loadSurvey() {
      try {
        const res = await api.get<{
          success: boolean;
          data: {
            title: string;
            description: string | null;
            status: string;
            questions: Array<{
              prompt: string;
              questionType: QuestionType;
              isRequired: boolean;
              options: Array<{ label: string }>;
            }>;
          };
        }>(`/surveys/${id}`);

        if (!active) return;
        const survey = res.data.data;
        if (survey.status !== 'DRAFT') {
          setError('Only draft surveys can be edited.');
          setLoadErrorCode(400);
          return;
        }

        setTitle(survey.title);
        setDescription(survey.description || '');
        setQuestions(
          survey.questions.map((q) => ({
            prompt: q.prompt,
            questionType: q.questionType,
            isRequired: q.isRequired,
            options: (q.options || []).map((o) => ({ label: o.label })),
          }))
        );
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
    } else if (title.length > 120) {
      errors.push('Survey title must be at most 120 characters.');
      fields[fieldKey.title] = 'Survey title must be at most 120 characters.';
    }

    if (description.length > 2000) {
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
      } else if (question.prompt.length > 500) {
        errors.push(`Question ${qNum}: Prompt must be at most 500 characters.`);
        fields[promptKey] = 'Prompt must be at most 500 characters.';
      }

      if (question.questionType === 'SINGLE_CHOICE') {
        const optionsKey = fieldKey.options(qIndex);
        if (question.options.length < 2) {
          errors.push(`Question ${qNum}: Single-choice questions must have at least 2 options.`);
          fields[optionsKey] = 'Single-choice questions must have at least 2 options.';
        } else if (question.options.length > 20) {
          errors.push(`Question ${qNum}: Single-choice questions cannot exceed 20 options.`);
          fields[optionsKey] = 'Single-choice questions cannot exceed 20 options.';
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
          }
          labels.push(trimmed.toLowerCase());
        });

        if (new Set(labels).size !== labels.length && !fields[optionsKey]) {
          errors.push(`Question ${qNum}: Option labels must be unique.`);
          fields[optionsKey] = 'Option labels must be unique within each question.';
        }
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
        options: type === 'SINGLE_CHOICE' ? [{ label: '' }, { label: '' }] : [],
      },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    setQuestionIndexToDelete(null);
  }

  function moveQuestion(index: number, direction: 'up' | 'down') {
    setQuestions((prev) => swapItems(prev, index, direction));
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
  }

  async function handleSaveDraft(): Promise<string | null> {
    if (!title.trim()) {
      setFieldErrors({ [fieldKey.title]: 'Survey title is required.' });
      document.getElementById(fieldKey.title)?.focus();
      return null;
    }

    setSaving(true);
    setError(null);
    setValidationErrors([]);
    setFieldErrors({});

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      questions: questions.map((q) => ({
        prompt: q.prompt.trim(),
        questionType: q.questionType,
        isRequired: q.isRequired,
        options: q.questionType === 'SINGLE_CHOICE' ? q.options.map((opt) => ({ label: opt.label.trim() })) : [],
      })),
    };

    try {
      if (surveyId) {
        await api.put(`/surveys/${surveyId}`, payload);
        return surveyId;
      } else {
        const res = await api.post<{ success: boolean; data: { id: string } }>('/surveys', payload);
        const newId = res.data.data.id;
        setSurveyId(newId);
        navigate(`/owner/surveys/${newId}/edit`, { replace: true });
        return newId;
      }
    } catch (err: unknown) {
      const errInfo = parseApiError(err, 'Failed to save survey.');
      setError(errInfo.message);
      applyServerValidationErrors(errInfo.details, setFieldErrors, setValidationErrors);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDraftClick() {
    const savedId = await handleSaveDraft();
    if (savedId) {
      navigate('/owner/surveys', { state: { successMessage: 'Draft survey saved successfully.' } });
    }
  }

  async function onPublishClick() {
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
      const errInfo = parseApiError(err, 'Publishing failed.');
      setError(errInfo.message);
      applyServerValidationErrors(errInfo.details, setFieldErrors, setValidationErrors);
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
      msg = 'You do not have permission to view or edit this survey.';
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
      </section>

      {/* Dynamic Questions List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Questions ({questions.length})</h3>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No questions added yet. Add at least one question to publish this survey.
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
                    className="p-1 text-red-400 hover:text-red-700 ml-2"
                  >
                    ✕
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
                      updateQuestion(qIndex, {
                        questionType: newType,
                        options: newType === 'SINGLE_CHOICE' ? [{ label: '' }, { label: '' }] : [],
                      });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="SINGLE_CHOICE">Single Choice</option>
                    <option value="SHORT_TEXT">Short Text</option>
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

              {/* Single Choice Options */}
              {question.questionType === 'SINGLE_CHOICE' && (
                <div
                  id={`options-${qIndex}`}
                  tabIndex={-1}
                  aria-invalid={Boolean(fieldErrors[`options-${qIndex}`])}
                  aria-describedby={fieldErrors[`options-${qIndex}`] ? `options-${qIndex}-error` : undefined}
                  className="space-y-2 pt-2 border-t border-slate-100 outline-none"
                >
                  <label className="block text-xs font-semibold text-slate-700">
                    Options (2–20 required for publish)
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
                              className="text-slate-400 hover:text-red-600 text-xs p-1 ml-0.5"
                            >
                              ✕
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
          confirmButtonClass="bg-slate-800 text-white hover:bg-slate-900"
          onCancel={() => setShowCloseConfirm(false)}
          onConfirm={() => navigate('/owner/surveys')}
        />
      )}

      {/* Confirmation Dialog for Question Removal */}
      {questionIndexToDelete !== null && (
        <ConfirmationModal
          title="Remove Question"
          message={`Are you sure you want to remove Question ${questionIndexToDelete + 1}? This action cannot be undone.`}
          confirmLabel="Remove"
          confirmButtonClass="bg-red-600 text-white hover:bg-red-700"
          onCancel={() => setQuestionIndexToDelete(null)}
          onConfirm={() => removeQuestion(questionIndexToDelete)}
        />
      )}
    </div>
  );
}
