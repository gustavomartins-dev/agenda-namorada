export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toSafeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  if (
    code === 'FST_REQ_FILE_TOO_LARGE' ||
    code === 'FST_FILES_LIMIT' ||
    code === 'FST_ERR_CTP_BODY_TOO_LARGE'
  ) {
    return new AppError(
      413,
      'REQUEST_TOO_LARGE',
      'O conteúdo enviado ultrapassou o limite permitido.',
    );
  }
  if (code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return new AppError(
      415,
      'UNSUPPORTED_CONTENT_TYPE',
      'Use Content-Type application/json nesta rota.',
    );
  }
  if (
    code === 'FST_ERR_CTP_INVALID_JSON_BODY' ||
    (error instanceof SyntaxError &&
      'statusCode' in error &&
      error.statusCode === 400)
  ) {
    return new AppError(
      400,
      'INVALID_JSON',
      'O corpo da requisição não contém um JSON válido.',
    );
  }
  if (error instanceof Error && error.message === 'Origem não permitida.') {
    return new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não permitida.');
  }
  return new AppError(
    500,
    'INTERNAL_ERROR',
    'Aconteceu um erro inesperado no servidor da agenda.',
    true,
  );
}
