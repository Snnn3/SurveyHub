import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import {
  getSurveyForm as getRespondentSurveyForm,
  getSurveyReceipt,
  listActiveSurveys,
  submitSurveyResponse,
} from '../controllers/response.controller';
import {
  listOwnerSurveys,
  createSurvey,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  publishSurvey,
  closeSurvey,
  getSurveySummary,
  getSurveyEligibility,
  replaceSurveyEligibility,
  getSurveySchedule,
  updateSurveySchedule,
} from '../controllers/survey.controller';

const router = Router();

const requireOwner = [authenticateJWT, requireRole(Role.SURVEY_OWNER)];
const requireRespondent = [authenticateJWT, requireRole(Role.RESPONDENT)];

router.get('/active', ...requireRespondent, listActiveSurveys);
router.get('/:id/form', ...requireRespondent, getRespondentSurveyForm);
router.post('/:id/responses', ...requireRespondent, submitSurveyResponse);
router.get('/:id/responses/:responseId', ...requireRespondent, getSurveyReceipt);

router.get('/', ...requireOwner, listOwnerSurveys);
router.post('/', ...requireOwner, createSurvey);
router.get('/:id/eligibility', ...requireOwner, getSurveyEligibility);
router.put('/:id/eligibility', ...requireOwner, replaceSurveyEligibility);
router.get('/:id/schedule', ...requireOwner, getSurveySchedule);
router.patch('/:id/schedule', ...requireOwner, updateSurveySchedule);

// Route registration order per SDS §4.4: F-03 GET /active must precede /:id so literal path is not captured as id
router.get('/:id/summary', ...requireOwner, getSurveySummary);
router.get('/:id', ...requireOwner, getSurveyById);
router.put('/:id', ...requireOwner, updateSurvey);
router.delete('/:id', ...requireOwner, deleteSurvey);
router.patch('/:id/publish', ...requireOwner, publishSurvey);
router.patch('/:id/close', ...requireOwner, closeSurvey);

export default router;
