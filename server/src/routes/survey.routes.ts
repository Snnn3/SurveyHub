import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import {
  listOwnerSurveys,
  createSurvey,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  publishSurvey,
  closeSurvey,
} from '../controllers/survey.controller';

const router = Router();

const requireOwner = [authenticateJWT, requireRole(Role.SURVEY_OWNER)];

router.get('/', ...requireOwner, listOwnerSurveys);
router.post('/', ...requireOwner, createSurvey);
router.get('/:id', ...requireOwner, getSurveyById);
router.put('/:id', ...requireOwner, updateSurvey);
router.delete('/:id', ...requireOwner, deleteSurvey);
router.patch('/:id/publish', ...requireOwner, publishSurvey);
router.patch('/:id/close', ...requireOwner, closeSurvey);

export default router;
