import { Effect } from 'effect'

export enum ErrorCode {
  OperationAborted = 'OperationAborted',
  PasskeysNotSupported = 'PasskeysNotSupported',
  DuplicateEmail = 'DuplicateEmail',
  DuplicatePasskey = 'DuplicatePasskey',
  PasskeyNotFound = 'PasskeyNotFound',
  InvalidTenancyID = 'InvalidTenancyID',
  InvalidClientID = 'InvalidClientID',
  InvalidApiKey = 'InvalidApiKey',
  UserNotFound = 'UserNotFound',
  UserDisabled = 'UserDisabled',
  InvalidRequest = 'InvalidRequest',
  InternalServerError = 'InternalServerError',
  InternalBrowserError = 'InternalBrowserError',
  VerificationFailure = 'VerificationFailure',
  OtherError = 'OtherError',
}

export class PasslockError extends Error {
  readonly _tag = 'PasslockError'
  readonly code: ErrorCode
  readonly detail?: unknown

  constructor(
    readonly options: {
      readonly message: string
      readonly code: ErrorCode
      readonly detail?: unknown
    },
  ) {
    super(options.message, { cause: options.detail })
    this.code = options.code
    this.detail = options.detail
  }

  toString() {
    return this.detail ? 
      `Message: ${this.message}, Code: ${this.code}, Detail: ${this.detail}` : 
      `Message: ${this.message}, Code: ${this.code}`
  }

  toJSON() {
    return { code: this.code, message: this.message, detail: this.detail }
  }
}

export const isPasslockError = (cause: unknown): cause is PasslockError => {
  if (typeof cause !== 'object') return false
  if (cause === null) return false

  if (!('message' in cause)) return false
  if (typeof cause.message !== 'string') return false

  if (!('code' in cause)) return false
  if (typeof cause.code !== 'string') return false

  return true
}

/**
 * Generate a Left(PasslockError)
 *
 * @param message
 * @param code
 * @param detail
 * @returns
 */
export const fail = (
  message: string,
  code: ErrorCode,
  detail?: unknown,
): Effect.Effect<never, PasslockError, never> => {
  return Effect.fail(error(message, code, detail))
}

export const error = (message: string, code: ErrorCode, detail?: unknown): PasslockError => {
  return new PasslockError({ message, code, detail })
}
