import { Data, Effect as E, pipe } from 'effect'
import * as v from 'valibot'

export class SerializationError extends Data.TaggedError('SerializationError')<{
  message: string
  detail?: unknown
}> {}

export class ParseError<TSchema extends v.BaseSchema = never> extends Data.TaggedError(
  'ParseError',
)<{
  message: string
  issues?: v.FlatErrors<TSchema>
}> {}

const nullish = <TSchema extends v.BaseSchema>(schema: TSchema) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return v.transform(v.optional(v.nullable(schema)), v => v ?? undefined)
}

const date = v.transform(v.string(), date => new Date(date))

/* Components */

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

const AuthType = v.union([v.literal('email'), v.literal('passkey')])

export type VerifyEmail = v.Output<typeof VerifyEmail>

/* Registration */

/**
 * Sent from the client to the backend to request the options
 */
export const RegistrationOptionsRequest = v.object({
  email: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  userVerification: nullish(UserVerification),
  verifyEmail: nullish(VerifyEmail),
  redirectUrl: nullish(v.string([v.url()])),
})

export type RegistrationOptionsRequest = v.Output<typeof RegistrationOptionsRequest>

export const RegistrationOptions = v.object({
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
})

export type RegistrationOptions = v.Output<typeof RegistrationOptions>

/**
 * The options needed by the browser to create a new credential,
 * along with a session token. The publicKey property represents a
 * PublicKeyCredentialCreationOptionsJSON
 */
export const RegistrationOptionsResponse = v.object({
  session: v.string(),
  publicKey: RegistrationOptions,
})

export type RegistrationOptionsResponse = v.Output<typeof RegistrationOptionsResponse>

/**
 * Public key credential (generated by the browser)
 */
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
 * What the client sends back to us after creating a passkey
 */
export const RegistrationVerificationRequest = v.object({
  session: v.string(),
  credential: RegistrationCredential,
  verifyEmail: nullish(VerifyEmail),
  redirectUrl: nullish(v.string([v.url()])),
})

export type RegistrationVerificationRequest = v.Output<typeof RegistrationVerificationRequest>

/* Authentication */

/** Send from the client to the browser to request auth options */
export const AuthenticationOptionsRequest = v.object({
  userVerification: nullish(UserVerification),
})

/** Backend response to the AuthenticationRequest */
export const AuthenticationOptionsResponse = v.object({
  session: v.string(),
  publicKey: v.object({
    rpId: v.string(),
    challenge: v.string(),
    timeout: v.number(),
    userVerification: UserVerification,
  }),
})

export type AuthenticationOptionsResponse = v.Output<typeof AuthenticationOptionsResponse>

/** Browser's response to the backend's auth challenge  */
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

/** Clients response to the backend's auth challenge  */
export const AuthenticationVerificationRequest = v.object({
  session: v.string(),
  credential: AuthenticationCredential,
})

/** Represents a successful registration/authentication */
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
    authType: AuthType,
    userVerified: v.boolean(),
    authTimestamp: date,
  }),
  expiresAt: date,
})

export type Principal = v.Output<typeof Principal>

/* isRegistered check */

export const IsRegisteredRequest = v.object({
  email: v.string(),
})

export type IsRegisteredRequest = v.Output<typeof IsRegisteredRequest>

export const IsRegisteredResponse = v.object({
  registered: v.boolean(),
})

// export type IsRegisteredResponse = v.Output<typeof IsRegisteredResponse>

/* Verify email */

export const VerifyEmailRequest = v.object({
  code: v.string(),
  token: v.string(),
})

export const VerifyEmailResponse = v.object({
  verified: v.boolean(),
})

export const AuthenticationRequired = v.object({
  requiredAuthType: AuthType,
})

export type VerifyEmailResponse = v.Output<typeof VerifyEmailResponse>

/* Utils */

export const createParser =
  <TSchema extends v.BaseSchema>(schema: TSchema) =>
  (input: unknown) =>
    pipe(
      v.safeParse(schema, input),
      result => (result.success ? E.succeed(result.output) : E.fail(v.flatten(result.issues))),
      effect => E.mapError(effect, issues => new ParseError({ message: 'Invalid data', issues })),
    )
