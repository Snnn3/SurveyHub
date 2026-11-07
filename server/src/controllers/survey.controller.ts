import { Request, Response, NextFunction } from 'express';
import { HttpError, NotFoundError } from '../utils/errors';
import { parseSurveyInput, parseSurveyId, formatZodDetails } from '../validators/survey.validator';
import * as surveyService from '../services/survey.service';

function getValidSurveyId(paramId: string): string {
  const id = parseSurveyId(paramId);
  if (!id) {
    throw new NotFoundError('Survey not found.');
  }
  return id;
}

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
    const id = getValidSurveyId(req.params.id);
    const ownerId = req.auth!.id;
    const survey = await surveyService.getSurveyById(id, ownerId);
    res.status(200).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
}

export async function updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const surveyId = getValidSurveyId(req.params.id);
    const ownerId = req.auth!.id;

    // Ownership guard per SDS §1.1 Architecture Layering & STS-F02-09
    // verifies ownership before body shape parsing to prevent unauthorized callers from probing survey structures.
    await surveyService.assertSurveyOwner(surveyId, ownerId);

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

    // Service-level domain validation (verifying DRAFT status) runs inside the transaction
    // in updateSurvey after shape validation, adhering to SDS §4.5 & §1.3.
    const updated = await surveyService.updateSurvey(surveyId, ownerId, parsed.data);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getValidSurveyId(req.params.id);
    const ownerId = req.auth!.id;
    await surveyService.deleteSurvey(id, ownerId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function publishSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getValidSurveyId(req.params.id);
    const ownerId = req.auth!.id;
    const published = await surveyService.publishSurvey(id, ownerId);
    res.status(200).json({ success: true, data: published });
  } catch (error) {
    next(error);
  }
}

export async function closeSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getValidSurveyId(req.params.id);
    const ownerId = req.auth!.id;
    const closed = await surveyService.closeSurvey(id, ownerId);
    res.status(200).json({ success: true, data: closed });
  } catch (error) {
    next(error);
  }
}
