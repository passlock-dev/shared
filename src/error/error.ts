import * as S from '@effect/schema/Schema'
import { Data } from 'effect'

export const ErrorCode = {
  NotSupported: 'NotSupported',
  BadRequest: 'BadRequest',
  Duplicate: 'Duplicate',
  Forbidden: 'Forbidden',
  InternalBrowserError: 'InternalBrowserError',
  InternalServerError: 'InternalServerError',
  NetworkError: 'NetworkError',
  NotFound: 'NotFound',
  Disabled: 'Disabled',
  Unauthorized: 'Unauthorized',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

/* Client errors */

/**
 * Browser doesn't support passkeys, autofill etc
 */
export class NotSupported extends Data.TaggedError(ErrorCode.NotSupported)<{
  message: string
}> {}

export class InternalBrowserError extends S.TaggedError<InternalBrowserError>()(
  ErrorCode.InternalBrowserError,
  {
    message: S.string,
    detail: S.optional(S.string),
  },
) {}

/* 400 style errors */

export class BadRequest extends S.TaggedError<BadRequest>()(ErrorCode.BadRequest, {
  message: S.string,
  detail: S.optional(S.string),
}) {}

/**
 * Email already in use, Passkey already registered etc
 */
export class Duplicate extends S.TaggedError<Duplicate>()(ErrorCode.Duplicate, {
  message: S.string,
  detail: S.optional(S.string),
}) {}

export class NotFound extends S.TaggedError<NotFound>()(ErrorCode.NotFound, {
  message: S.string,
  detail: S.optional(S.string),
}) {}

/**
 * User/API key is disabled
 */
export class Disabled extends S.TaggedError<Disabled>()(ErrorCode.Disabled, {
  message: S.string,
  detail: S.optional(S.string),
}) {}

/* Permissions */

export class Unauthorized extends S.TaggedError<Unauthorized>()(ErrorCode.Unauthorized, {
  message: S.string,
  detail: S.optional(S.string),
}) {}

export class Forbidden extends S.TaggedError<Forbidden>()(ErrorCode.Forbidden, {
  message: S.string,
  detail: S.optional(S.string),
}) {}

/* Other errors */

export class NetworkError extends S.TaggedError<NetworkError>()(ErrorCode.NetworkError, {
  message: S.string,
  detail: S.optional(S.string),
}) {}

export class InternalServerError extends S.TaggedError<InternalServerError>()(
  ErrorCode.InternalServerError,
  {
    message: S.string,
    detail: S.optional(S.string),
  },
) {}