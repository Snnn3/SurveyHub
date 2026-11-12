import { Router } from 'express';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import surveyRoutes from './survey.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/surveys', surveyRoutes);

export default router;
