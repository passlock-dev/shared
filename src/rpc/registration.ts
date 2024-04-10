import { Router } from '@effect/rpc'
import * as Rpc from '@effect/rpc/Rpc'
import * as S from '@effect/schema/Schema'
import { Context, Effect as E, pipe } from 'effect'

import { BadRequest, Duplicate, Forbidden, Unauthorized } from '../error/error.js'
import {
  Principal,
  RegistrationCredential,
  RegistrationOptions,
  UserVerification,
  VerifyEmail,
} from '../schema/schema.js'

/* Requests & Responses */

/* Options */
export class OptionsRes extends S.Class<OptionsRes>('@registration/OptionsRes')({
  session: S.string,
  publicKey: RegistrationOptions,
}) {}

export const OptionsErrors = S.union(BadRequest, Duplicate)

export type OptionsErrors = S.Schema.Type<typeof OptionsErrors>

export class OptionsReq extends S.TaggedRequest<OptionsReq>()(
  '@registration/OptionsReq',
  OptionsErrors,
  OptionsRes,
  {
    email: S.string,
    givenName: S.string,
    familyName: S.string,
    userVerification: S.optional(UserVerification),
    verifyEmail: S.optional(VerifyEmail),
    redirectUrl: S.optional(S.string),
  },
) {}

/* // Options */

/* Verification */
export class VerificationRes extends S.Class<VerificationRes>('@registration/VerificationRes')({
  principal: Principal,
}) {}

export const VerificationErrors = S.union(BadRequest, Duplicate, Unauthorized, Forbidden)

export type VerificationErrors = S.Schema.Type<typeof VerificationErrors>

export class VerificationReq extends S.TaggedRequest<VerificationReq>()(
  '@registration/VerificationReq',
  VerificationErrors,
  VerificationRes,
  {
    session: S.string,
    credential: RegistrationCredential,
    verifyEmail: S.optional(VerifyEmail),
    redirectUrl: S.optional(S.string),
  },
) {}
/* // Verification */

/** Router operations */
export type RegistrationOps = {
  getRegistrationOptions: (req: OptionsReq) => E.Effect<OptionsRes, OptionsErrors>
  verifyRegistrationCredential: (
    req: VerificationReq,
  ) => E.Effect<VerificationRes, VerificationErrors>
}

/** The server should implement this interface */
export class RegistrationHandler extends Context.Tag('@registration/RegistrationHandler')<
  RegistrationHandler,
  RegistrationOps
>() {}

/** Depends on a RegistrationHandler to actually do the work  */
export const RegistrationRouter = Router.make(
  Rpc.effect(OptionsReq, req =>
    pipe(
      RegistrationHandler,
      E.flatMap(handler => handler.getRegistrationOptions(req)),
    ),
  ),
  Rpc.effect(VerificationReq, req =>
    pipe(
      RegistrationHandler,
      E.flatMap(handler => handler.verifyRegistrationCredential(req)),
    ),
  ),
)
