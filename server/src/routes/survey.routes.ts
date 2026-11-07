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

router.use(authenticateJWT, requireRole(Role.SURVEY_OWNER));

router.get('/', listOwnerSurveys);
router.post('/', createSurvey);
router.get('/:id', getSurveyById);
router.put('/:id', updateSurvey);
router.delete('/:id', deleteSurvey);
router.patch('/:id/publish', publishSurvey);
router.patch('/:id/close', closeSurvey);

export default router;
