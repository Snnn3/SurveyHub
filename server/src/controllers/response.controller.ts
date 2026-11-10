import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/errors';
import { getValidUuid } from '../utils/uuid';
import { parseResponseInput } from '../validators/response.validator';
import { formatZodDetails } from '../validators/validation';
import * as responseService from '../services/response.service';

export async function listActiveSurveys(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await responseService.listActiveSurveys(req.auth!.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getSurveyForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await responseService.getSurveyForm(getValidUuid(req.params.id, 'Survey'));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function submitSurveyResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const surveyId = getValidUuid(req.params.id, 'Survey');
    const parsed = parseResponseInput(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        'INVALID_ANSWER',
        'One or more submitted answers are invalid.',
        formatZodDetails(parsed.error)
      );
    }

    const response = await responseService.submitSurveyResponse(
      surveyId,
      req.auth!.id,
      parsed.data
    );
    res.status(201).json({
      success: true,
      data: {
        responseId: response.id,
        surveyId: response.surveyId,
        submittedAt: response.submittedAt.toISOString(),
        message: 'Survey response successfully recorded.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getSurveyReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const surveyId = getValidUuid(req.params.id, 'Survey');
    const responseId = getValidUuid(req.params.responseId, 'Response');
    const data = await responseService.getSurveyReceipt(surveyId, responseId, req.auth!.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
