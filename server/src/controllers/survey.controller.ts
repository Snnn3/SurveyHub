import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/errors';
import { parseSurveyInput, formatZodDetails } from '../validators/survey.validator';
import * as surveyService from '../services/survey.service';

export async function listOwnerSurveys(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const data = await surveyService.listOwnerSurveys(ownerId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = parseSurveyInput(req.body);
  if (!parsed.success) {
    next(
      new HttpError(
        400,
        'VALIDATION_ERROR',
        'Invalid survey data.',
        formatZodDetails(parsed.error)
      )
    );
    return;
  }

  try {
    const ownerId = req.auth!.id;
    const survey = await surveyService.createSurvey(ownerId, parsed.data);
    res.status(201).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
}

export async function getSurveyById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const survey = await surveyService.getSurveyById(req.params.id, ownerId);
    res.status(200).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
}

export async function updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    // Ownership and draft status must be checked before validating payload per STS-F02-09 & BR-04
    await surveyService.assertSurveyEditable(req.params.id, ownerId);

    const parsed = parseSurveyInput(req.body);
    if (!parsed.success) {
      next(
        new HttpError(
          400,
          'VALIDATION_ERROR',
          'Invalid survey structure.',
          formatZodDetails(parsed.error)
        )
      );
      return;
    }

    const updated = await surveyService.updateSurvey(req.params.id, parsed.data);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    await surveyService.deleteSurvey(req.params.id, ownerId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function publishSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const published = await surveyService.publishSurvey(req.params.id, ownerId);
    res.status(200).json({ success: true, data: published });
  } catch (error) {
    next(error);
  }
}

export async function closeSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const closed = await surveyService.closeSurvey(req.params.id, ownerId);
    res.status(200).json({ success: true, data: closed });
  } catch (error) {
    next(error);
  }
}
