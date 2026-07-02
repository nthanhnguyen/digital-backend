import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomError extends HttpException {
  code?: string;
  title?: string;

  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    code?: string,
    title?: string,
  ) {
    super(message, status);
    this.code = code;
    this.title = title;
    this.name = this.constructor.name;
  }
}

export class BadRequestError extends CustomError {
  constructor(message: string, code?: string) {
    super(message, HttpStatus.BAD_REQUEST, code, 'Bad Request');
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string, code?: string) {
    super(message, HttpStatus.UNAUTHORIZED, code, 'Unauthorized');
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string, code?: string) {
    super(message, HttpStatus.FORBIDDEN, code, 'Forbidden');
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string, code?: string) {
    super(message, HttpStatus.NOT_FOUND, code, 'Not Found');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string, code?: string) {
    super(message, HttpStatus.CONFLICT, code, 'Conflict');
  }
}

export class InternalServerError extends CustomError {
  constructor(message: string, code?: string) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR, code, 'Internal Server Error');
  }
}

export class UnprocessableEntityError extends CustomError {
  constructor(message: string, code?: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, code, 'Unprocessable Entity');
  }
}
