import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../api';

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

export function SurveyEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<FormQuestion[]>([
    {
      prompt: '',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      options: [{ label: '' }, { label: '' }],
    },
  ]);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [questionToDelete, setQuestionToDelete] = useState<number | null>(null);

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
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error?.message || err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load survey.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSurvey();
    return () => {
      active = false;
    };
  }, [id]);

  function validateForPublish(): string[] {
    const errors: string[] = [];
    if (!title.trim()) errors.push('Survey title is required.');
    if (title.length > 120) errors.push('Survey title must be at most 120 characters.');
    if (description.length > 2000) errors.push('Description must be at most 2,000 characters.');

    if (questions.length === 0) {
      errors.push('Survey must contain at least one question to be published.');
      return errors;
    }

    questions.forEach((q, qIndex) => {
      const qNum = qIndex + 1;
      if (!q.prompt.trim()) {
        errors.push(`Question ${qNum}: Prompt cannot be empty.`);
      } else if (q.prompt.length > 500) {
        errors.push(`Question ${qNum}: Prompt must be at most 500 characters.`);
      }

      if (q.questionType === 'SINGLE_CHOICE') {
        if (q.options.length < 2) {
          errors.push(`Question ${qNum}: Single-choice questions must have at least 2 options.`);
        } else if (q.options.length > 20) {
          errors.push(`Question ${qNum}: Single-choice questions cannot exceed 20 options.`);
        }

        const labels = q.options.map((opt) => opt.label.trim().toLowerCase());
        if (labels.some((l) => l.length === 0)) {
          errors.push(`Question ${qNum}: All option labels must be filled in.`);
        }
        if (new Set(labels).size !== labels.length) {
          errors.push(`Question ${qNum}: Option labels must be unique.`);
        }
      }
    });

    return errors;
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
    setQuestionToDelete(null);
  }

  function moveQuestion(index: number, direction: 'up' | 'down') {
    setQuestions((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  }

  function updateQuestion(index: number, patch: Partial<FormQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  }

  function addOption(questionIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        if (q.options.length >= 20) return q;
        return {
          ...q,
          options: [...q.options, { label: '' }],
        };
      })
    );
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        return {
          ...q,
          options: q.options.filter((_, optIdx) => optIdx !== optionIndex),
        };
      })
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, label: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        const options = [...q.options];
        options[optionIndex] = { label };
        return { ...q, options };
      })
    );
  }

  async function handleSaveDraft(): Promise<string | null> {
    if (!title.trim()) {
      setError('Title is required.');
      return null;
    }

    setSaving(true);
    setError(null);
    setValidationErrors([]);

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
      if (isEditing) {
        await api.put(`/surveys/${id}`, payload);
        return id!;
      } else {
        const res = await api.post<{ success: boolean; data: { id: string } }>('/surveys', payload);
        return res.data.data.id;
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error?.message || 'Failed to save survey.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save survey.');
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDraftClick() {
    const savedId = await handleSaveDraft();
    if (savedId) {
      navigate('/owner/surveys');
    }
  }

  async function onPublishClick() {
    const errors = validateForPublish();
    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setValidationErrors([]);
    const savedId = await handleSaveDraft();
    if (!savedId) return;

    setSaving(true);
    try {
      await api.patch(`/surveys/${savedId}/publish`);
      navigate('/owner/surveys');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error?.message || 'Publishing failed.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Publishing failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center" role="status">
        <p className="text-sm text-slate-600">Loading survey editor...</p>
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
        <Link
          to="/owner/surveys"
          className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., CPE 334 Midterm Feedback"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide context or instructions for respondents..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{description.length} / 2,000 characters</p>
        </div>
      </section>

      {/* Dynamic Questions List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Questions ({questions.length})</h3>
          <div className="flex items-center gap-2">
            <button
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
          questions.map((q, qIndex) => (
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
                    disabled={qIndex === 0}
                    onClick={() => moveQuestion(qIndex, 'up')}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    disabled={qIndex === questions.length - 1}
                    onClick={() => moveQuestion(qIndex, 'down')}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    title="Remove question"
                    onClick={() => setQuestionToDelete(qIndex)}
                    className="p-1 text-red-400 hover:text-red-700 ml-2"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Prompt <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qIndex, { prompt: e.target.value })}
                  placeholder="e.g. How satisfied are you with the course?"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Type and Required Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-slate-700">Type:</label>
                  <select
                    value={q.questionType}
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
                    checked={q.isRequired}
                    onChange={(e) => updateQuestion(qIndex, { isRequired: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  Required response
                </label>
              </div>

              {/* Single Choice Options */}
              {q.questionType === 'SINGLE_CHOICE' && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700">
                    Options (2–20 required for publish)
                  </label>
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-5 text-right">{optIndex + 1}.</span>
                      <input
                        type="text"
                        maxLength={200}
                        value={opt.label}
                        onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                        placeholder={`Option ${optIndex + 1}`}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(qIndex, optIndex)}
                          className="text-slate-400 hover:text-red-600 text-xs px-2 py-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  {q.options.length < 20 && (
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
        <Link
          to="/owner/surveys"
          className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-center"
        >
          Cancel
        </Link>
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

      {/* Confirmation Dialog for Question Removal */}
      {questionToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Remove Question</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to remove Question {questionToDelete + 1}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setQuestionToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeQuestion(questionToDelete)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
