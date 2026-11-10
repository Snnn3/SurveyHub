import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/errors';
import { getValidUuid } from '../utils/uuid';
import { formatZodDetails } from '../validators/validation';
import { parseSurveyInput } from '../validators/survey.validator';
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
    const id = getValidUuid(req.params.id, 'Survey');
    const ownerId = req.auth!.id;
    const survey = await surveyService.getSurveyById(id, ownerId);
    res.status(200).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
}

export async function updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const surveyId = getValidUuid(req.params.id, 'Survey');
    const ownerId = req.auth!.id;

    // Guard ownership and draft status per Spec F-02 Section 3.4 (1. Verify owner and DRAFT)
    // and STS-F02-10 before shape validation to reject edits on non-draft surveys regardless of payload shape.
    await surveyService.assertSurveyEditable(surveyId, ownerId);

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
    const id = getValidUuid(req.params.id, 'Survey');
    const ownerId = req.auth!.id;
    await surveyService.deleteSurvey(id, ownerId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function publishSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getValidUuid(req.params.id, 'Survey');
    const ownerId = req.auth!.id;
    const published = await surveyService.publishSurvey(id, ownerId);
    res.status(200).json({ success: true, data: published });
  } catch (error) {
    next(error);
  }
}

export async function closeSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getValidUuid(req.params.id, 'Survey');
    const ownerId = req.auth!.id;
    const closed = await surveyService.closeSurvey(id, ownerId);
    res.status(200).json({ success: true, data: closed });
  } catch (error) {
    next(error);
  }
}

export async function getSurveySummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getValidUuid(req.params.id, 'Survey');
    const ownerId = req.auth!.id;
    const summary = await surveyService.getSurveySummary(id, ownerId);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}
