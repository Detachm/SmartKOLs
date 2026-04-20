import { AppError } from "../errors/app-error";

export type Ok<T> = {
  ok: true;
  data: T;
};

export type Err = {
  ok: false;
  error: {
    code: AppError["code"];
    message: string;
    details?: Record<string, unknown>;
  };
};

export type Result<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err(error: AppError): Err {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}
