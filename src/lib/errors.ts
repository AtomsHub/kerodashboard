// src/lib/errors.ts
// Standardised API Error types & Form Error mapping for Kero Admin Dashboard.
// Mirrors kero-mobile/packages/api-client/src/errors.ts and apply-api-form-error.ts.

import { toast } from 'sonner';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface ApiFieldError {
  path: (string | number)[];
  message: string;
}

export interface BackendErrorEnvelope {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    statusCode?: number;
    requestId?: string;
    details?: {
      issues?: Array<{
        path?: (string | number)[];
        message?: string;
      }>;
    };
  };
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly requestId?: string;
  readonly backendCode?: string;
  readonly fields: ApiFieldError[];
  readonly rawDetails?: unknown;

  constructor(
    message: string,
    code: ApiErrorCode,
    status?: number,
    fields: ApiFieldError[] = [],
    requestId?: string,
    backendCode?: string,
    rawDetails?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.requestId = requestId;
    this.backendCode = backendCode;
    this.rawDetails = rawDetails;
  }
}

/**
 * Normalise any error (AxiosError, fetch error, Network failure, etc.) into a consistent ApiError.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  // Axios or HTTP response error
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosErr = error as {
      response?: {
        status?: number;
        data?: BackendErrorEnvelope;
        headers?: Record<string, string>;
      };
      message?: string;
    };

    const status = axiosErr.response?.status;
    const body = axiosErr.response?.data;
    const errorBody = body?.error;

    const message =
      errorBody?.message ||
      (status === 401
        ? 'Session expired. Please log in again.'
        : status === 403
        ? 'You do not have permission to perform this action.'
        : status === 404
        ? 'Resource not found.'
        : status === 409
        ? 'A conflicting record already exists.'
        : status === 429
        ? 'Too many requests. Please slow down.'
        : status && status >= 500
        ? 'Internal server error. Please try again later.'
        : axiosErr.message || 'An unexpected error occurred.');

    const fields: ApiFieldError[] = [];
    if (errorBody?.details?.issues && Array.isArray(errorBody.details.issues)) {
      for (const issue of errorBody.details.issues) {
        if (issue.path && Array.isArray(issue.path) && issue.message) {
          fields.push({ path: issue.path, message: issue.message });
        }
      }
    }

    let code: ApiErrorCode = 'UNKNOWN_ERROR';
    if (status === 400 || status === 422 || fields.length > 0) code = 'VALIDATION_ERROR';
    else if (status === 401) code = 'UNAUTHORIZED';
    else if (status === 403) code = 'FORBIDDEN';
    else if (status === 404) code = 'NOT_FOUND';
    else if (status === 409) code = 'CONFLICT';
    else if (status === 429) code = 'RATE_LIMITED';
    else if (status && status >= 500) code = 'SERVER_ERROR';

    return new ApiError(
      message,
      code,
      status,
      fields,
      errorBody?.requestId,
      errorBody?.code,
      errorBody
    );
  }

  // Network offline / abort error
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'CanceledError') {
      return new ApiError('Request cancelled', 'CANCELLED');
    }
    if (error.message.includes('Network Error') || error.message.includes('fetch failed')) {
      return new ApiError(
        'Unable to connect to Kero server. Check your internet connection and try again.',
        'NETWORK_ERROR'
      );
    }
    return new ApiError(error.message, 'UNKNOWN_ERROR');
  }

  return new ApiError('Something went wrong. Please try again.', 'UNKNOWN_ERROR');
}

/**
 * Maps API validation errors to form field errors (React Hook Form / Zod)
 * and sets the form-level alert or toast for unmapped errors.
 */
export function applyApiFormError(
  error: unknown,
  options: {
    setError?: (name: any, error: { type: string; message: string }) => void;
    setFormError?: (message: string | null) => void;
    fields?: readonly string[];
    fallbackMessage?: string;
    showToast?: boolean;
  }
): ApiError {
  const apiError = toApiError(error);
  let unmapped = apiError.fields.length === 0;

  // Map backend field issues to registered form fields
  if (options.setError && apiError.fields.length > 0) {
    for (const issue of apiError.fields) {
      const fieldPath = issue.path.join('.');
      const matchesField = options.fields ? options.fields.includes(fieldPath) : true;
      if (matchesField) {
        options.setError(fieldPath, { type: 'server', message: issue.message });
      } else {
        unmapped = true;
      }
    }
  }

  // If there are unmapped field errors or general server errors, show form banner and/or toast
  if (unmapped) {
    const bannerMsg =
      apiError.code === 'UNKNOWN_ERROR' && options.fallbackMessage
        ? options.fallbackMessage
        : apiError.message;

    options.setFormError?.(bannerMsg);

    if (options.showToast !== false) {
      toast.error(apiError.message, {
        description: apiError.requestId ? `Trace ID: ${apiError.requestId}` : undefined,
      });
    }
  }

  return apiError;
}
