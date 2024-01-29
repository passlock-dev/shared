import { ParseOptions } from '@effect/schema/AST'
import { ParseError } from '@effect/schema/ParseResult'
import * as S from '@effect/schema/Schema'
import { formatError } from '@effect/schema/TreeFormatter'
import { Effect as E, Option, pipe } from 'effect'

import { ErrorCode, error } from '../error/error'
import { PasslockLogger } from '../logging/logging'
import { Nullish } from '../utils/nullish'

/* Components */

/**
 * Transform T | undefined | null => T | undefined
 * TODO must be a better way?
 * @param s 
 * @returns 
 */
const nullish = <T>(s: S.Schema<never, T>) => pipe(
  S.optionFromNullish(s, undefined),
  S.transform(S.union(s, S.undefined), Option.getOrUndefined, Option.fromNullable)
)

const PublicKey = S.literal('public-key')

const PubKeyCredParams = S.struct({
  alg: S.number,
  type: PublicKey,
})

const AuthenticatorAttachment = S.union(
  S.literal('cross-platform'), 
  S.literal('platform')
)

const base64url = S.string

const Transport = S.union(
  S.literal('ble'),
  S.literal('hybrid'),
  S.literal('internal'),
  S.literal('nfc'),
  S.literal('usb'),
  // S.literal('cable'), // Not yet supported by @github/webauthn-json
  // S.literal('smart-card'), // Not yet supported by @github/webauthn-json
)

const Credential = S.struct({
  id: base64url,
  type: PublicKey,
  transports: S.mutable(S.array(Transport)),
})

const UserVerification = S.union(
  S.literal('discouraged'),
  S.literal('preferred'),
  S.literal('required'),
)

export type UserVerification = S.Schema.To<typeof UserVerification>

const ResidentKey = S.union(
  S.literal('discouraged'), 
  S.literal('preferred'), 
  S.literal('required')
)

const AuthenticatorSelection = S.struct({
  authenticatorAttachment: nullish(AuthenticatorAttachment),
  residentKey: nullish(ResidentKey),
  requireResidentKey: nullish(S.boolean),
  userVerification: nullish(UserVerification),
})

const ClientExtensionResults = S.struct({
  appid: nullish(S.boolean),
  credProps: S.optional(
    S.struct({
      rk: nullish(S.boolean),
    }),
  ),
  hmacCreateSecret: nullish(S.boolean),
})

/* Registration */

export const RegistrationRequest = S.struct({
  email: S.string,
  firstName: S.string,
  lastName: S.string,
  userVerification: nullish(UserVerification),
})

/**
 * The options needed by the browser to create a new credential,
 * along with a session token. The publicKey property represents a
 * PublicKeyCredentialCreationOptionsJSON
 */
export const RegistrationOptions = S.struct({
  session: S.string,
  publicKey: S.struct({
    rp: S.struct({
      name: S.string,
      id: base64url,
    }),
    user: S.struct({
      id: base64url,
      name: S.string,
      displayName: S.string,
    }),
    challenge: base64url,
    pubKeyCredParams: S.mutable(S.array(PubKeyCredParams)),
    timeout: S.number,
    excludeCredentials: S.mutable(S.array(Credential)),
    authenticatorSelection: AuthenticatorSelection,
  }),
})

export type RegistrationOptions = S.Schema.To<typeof RegistrationOptions>

export const RegistrationCredential = S.struct({
  id: S.string,
  rawId: S.string,
  type: PublicKey,
  response: S.struct({
    clientDataJSON: S.string,
    attestationObject: S.string,
    authenticatorData: nullish(S.string),
    transports: nullish(S.mutable(S.array(Transport))),
    publicKeyAlgorithm: nullish(S.number),
    publicKey: nullish(S.string),
  }),
  clientExtensionResults: ClientExtensionResults,
  authenticatorAttachment: nullish(AuthenticatorAttachment),
})

export const RegistrationResponse = S.struct({
  session: S.string,
  credential: RegistrationCredential,
})

export type RegistrationResponse = S.Schema.To<typeof RegistrationResponse>

/* Authentication */

export const AuthenticationRequest = S.struct({
  userVerification: nullish(UserVerification),
})

export const AuthenticationOptions = S.struct({
  session: S.string,
  publicKey: S.struct({
    rpId: S.string,
    challenge: S.string,
    timeout: S.number,
    userVerification: UserVerification,
  }),
})

export type AuthenticationOptions = S.Schema.To<typeof AuthenticationOptions>

export const AuthenticationCredential = S.struct({
  id: S.string,
  rawId: S.string,
  type: PublicKey,
  response: S.struct({
    clientDataJSON: S.string,
    authenticatorData: S.string,
    signature: S.string,
    userHandle: nullish(S.string),
  }),
  authenticatorAttachment: nullish(AuthenticatorAttachment),
  clientExtensionResults: ClientExtensionResults,
})

export const AuthenticationResponse = S.struct({
  session: S.string,
  credential: AuthenticationCredential,
})

export const parseAuthenticationOptions = S.decodeEither

export const Principal = S.struct({
  token: S.string,
  subject: S.struct({
    id: S.string,
    firstName: S.string,
    lastName: S.string,
    email: S.string,
    emailVerified: S.boolean,
  }),
  authStatement: S.struct({
    authType: S.union(S.literal('email'), S.literal('passkey')),
    userVerified: S.boolean,
    authTimestamp: S.Date,
  }),
  expiresAt: S.Date,
})

export type Principal = S.Schema.To<typeof Principal>

/* Check */

export const CheckRegistration = S.struct({
  registered: S.boolean,
})

export type CheckRegistration = S.Schema.To<typeof CheckRegistration>

/* Utils */

export const createParser = <From, To>(schema: S.Schema<never, From, Nullish<To>>) => {
  const parse = S.decodeUnknown(schema)

  /**
   * The parser generates some nicely formatted errors but they don't
   * play well with Effects logger so we log them inline using a raw
   * (i.e. console) logger
   *
   * @param parseError
   * @returns
   */
  const logError = (parseError: ParseError) => {
    console.log(formatError(parseError))

    return PasslockLogger.pipe(
      E.flatMap(logger =>
        E.sync(() => {
          const formatted = formatError(parseError)
          logger.logRaw(formatted)
        }),
      ),
    )
  }

  const transformError = (e: ParseError) => {
    return error('Unable to parse object', ErrorCode.InternalServerError, formatError(e))
  }

  return (data: object, options?: ParseOptions) =>
    pipe(
      parse(data, options), 
      E.tapError(logError), 
      E.mapError(transformError)
    )
}
