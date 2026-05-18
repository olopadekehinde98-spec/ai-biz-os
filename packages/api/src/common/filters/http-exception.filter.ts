import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status >= 500) {
      Sentry.captureException(exception, {
        extra: {
          url: request.url,
          method: request.method,
          userId: (request as any).user?.id,
          businessId: request.headers['x-business-id'],
        },
      });
      this.logger.error('Unhandled exception', { exception, url: request.url });
    }

    response.status(status).json({
      data: null,
      error: {
        statusCode: status,
        message:
          typeof message === 'object' && 'message' in (message as object)
            ? (message as any).message
            : message,
        code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
