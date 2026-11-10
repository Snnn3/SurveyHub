import { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../utils/errors';
import { parseSurveyId } from '../validators/survey.validator';
import * as responseService from '../services/response.service';
import { getValidSurveyId } from './survey.controller';

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
    const data = await responseService.getSurveyForm(getValidSurveyId(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function submitSurveyResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const response = await responseService.submitSurveyResponse(
      getValidSurveyId(req.params.id),
      req.auth!.id,
      req.body
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
    const surveyId = getValidSurveyId(req.params.id);
    const responseId = parseSurveyId(req.params.responseId);
    if (!responseId) throw new NotFoundError('Response not found.');
    const data = await responseService.getSurveyReceipt(surveyId, responseId, req.auth!.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
