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
  Forbidden = 'Forbidden',
  Unauthorized = 'Unauthorized',
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

  toJSON() {
    let detail: unknown

    try {
      if (
        this.detail && 
        typeof this.detail === "object" &&
        'toJSON' in this.detail &&
        typeof this.detail.toJSON === 'function'
      ) {
        detail = this.detail.toJSON()
      }
    } catch { }

    return detail ? 
      { message: this.message, code: this.code, detail } : 
      { message: this.message, code: this.code }
  }

  toString() {
    let detail: string | undefined = undefined

    try {
      detail = this.detail?.toString()
    } catch { }

    return detail ? 
      `${this.code}: ${this.message}, ${detail}` : 
      `${this.code}: ${this.message}` 
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
