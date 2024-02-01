import { Effect as E, pipe } from 'effect'
import * as v from 'valibot' // 1.2 kB

import { ErrorCode, error } from '../error/error'
import { PasslockLogger } from '../logging/logging'

const nullish = <TSchema extends v.BaseSchema>(schema: TSchema) =>
  v.transform(v.nullish(schema), v => v ?? undefined) // eslint-disable-line @typescript-eslint/no-unsafe-return

const date = v.transform(v.string(), date => new Date(date))

const PublicKey = v.literal('public-key')

const PubKeyCredParams = v.object({
  alg: v.number(),
  type: PublicKey,
})

const AuthenticatorAttachment = v.union([v.literal('cross-platform'), v.literal('platform')])

const base64url = v.string

const Transport = v.union([
  v.literal('ble'),
  v.literal('hybrid'),
  v.literal('internal'),
  v.literal('nfc'),
  v.literal('usb'),
  // v.literal('cable'), // Not yet supported by @github/webauthn-json
  // v.literal('smart-card'), // Not yet supported by @github/webauthn-json
])

const Credential = v.object({
  id: base64url(),
  type: PublicKey,
  transports: v.array(Transport),
})

const UserVerification = v.union([
  v.literal('discouraged'),
  v.literal('preferred'),
  v.literal('required'),
])

export type UserVerification = v.Output<typeof UserVerification>

const ResidentKey = v.union([
  v.literal('discouraged'),
  v.literal('preferred'),
  v.literal('required'),
])

const AuthenticatorSelection = v.object({
  authenticatorAttachment: nullish(AuthenticatorAttachment),
  residentKey: nullish(ResidentKey),
  requireResidentKey: nullish(v.boolean()),
  userVerification: nullish(UserVerification),
})

const ClientExtensionResults = v.object({
  appid: nullish(v.boolean()),
  credProps: nullish(
    v.object({
      rk: nullish(v.boolean()),
    }),
  ),
  hmacCreateSecret: nullish(v.boolean()),
})

const VerifyEmail = v.union([v.literal('link'), v.literal('code')])

export type VerifyEmail = v.Output<typeof VerifyEmail>

/* Registration */

export const RegistrationRequest = v.object({
  email: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  userVerification: nullish(UserVerification),
})

/**
 * The options needed by the browser to create a new credential,
 * along with a session token. The publicKey property represents a
 * PublicKeyCredentialCreationOptionsJSON
 */
export const RegistrationOptions = v.object({
  session: v.string(),
  publicKey: v.object({
    rp: v.object({
      name: v.string(),
      id: base64url(),
    }),
    user: v.object({
      id: base64url(),
      name: v.string(),
      displayName: v.string(),
    }),
    challenge: base64url(),
    pubKeyCredParams: v.array(PubKeyCredParams),
    timeout: v.number(),
    excludeCredentials: v.array(Credential),
    authenticatorSelection: AuthenticatorSelection,
  }),
})

export type RegistrationOptions = v.Output<typeof RegistrationOptions>

export const RegistrationCredential = v.object({
  id: v.string(),
  rawId: v.string(),
  type: PublicKey,
  response: v.object({
    clientDataJSON: v.string(),
    attestationObject: v.string(),
    authenticatorData: nullish(v.string()),
    transports: nullish(v.array(Transport)),
    publicKeyAlgorithm: nullish(v.number()),
    publicKey: nullish(v.string()),
  }),
  clientExtensionResults: ClientExtensionResults,
  authenticatorAttachment: nullish(AuthenticatorAttachment),
})

/**
 * What the browser sends back to us
 */
export const RegistrationResponse = v.object({
  session: v.string(),
  credential: RegistrationCredential,
  verifyEmail: nullish(VerifyEmail),
  redirectUrl: nullish(v.string([v.url()])),
})

export type RegistrationResponse = v.Output<typeof RegistrationResponse>

/* Authentication */

export const AuthenticationRequest = v.object({
  userVerification: nullish(UserVerification),
})

export const AuthenticationOptions = v.object({
  session: v.string(),
  publicKey: v.object({
    rpId: v.string(),
    challenge: v.string(),
    timeout: v.number(),
    userVerification: UserVerification,
  }),
})

export type AuthenticationOptions = v.Output<typeof AuthenticationOptions>

export const AuthenticationCredential = v.object({
  id: v.string(),
  rawId: v.string(),
  type: PublicKey,
  response: v.object({
    clientDataJSON: v.string(),
    authenticatorData: v.string(),
    signature: v.string(),
    userHandle: nullish(v.string()),
  }),
  authenticatorAttachment: nullish(AuthenticatorAttachment),
  clientExtensionResults: ClientExtensionResults,
})

export const AuthenticationResponse = v.object({
  session: v.string(),
  credential: AuthenticationCredential,
})

export const Principal = v.object({
  token: v.string(),
  subject: v.object({
    id: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
  }),
  authStatement: v.object({
    authType: v.union([v.literal('email'), v.literal('passkey')]),
    userVerified: v.boolean(),
    authTimestamp: date,
  }),
  expiresAt: date,
})

export type Principal = v.Output<typeof Principal>

/* Check */

export const CheckRegistration = v.object({
  registered: v.boolean(),
})

export type CheckRegistration = v.Output<typeof CheckRegistration>

/* Utils */

const log = (message: unknown) => E.flatMap(PasslockLogger, logger => logger.logRaw(message))

export const createParser =
  <TSchema extends v.BaseSchema>(schema: TSchema) =>
  (input: unknown) =>
    pipe(
      v.safeParse(schema, input),
      result => (result.success ? E.succeed(result.output) : E.fail(v.flatten(result.issues))),
      effect => E.tapError(effect, issues => log(issues)),
      effect =>
        E.mapError(effect, issues => error('Validation failure', ErrorCode.InvalidRequest, issues)),
    )
