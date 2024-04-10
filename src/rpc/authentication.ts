import { Router } from '@effect/rpc'
import * as Rpc from '@effect/rpc/Rpc'
import * as S from '@effect/schema/Schema'
import { Context, Effect as E, pipe } from 'effect'

import { BadRequest, Disabled, Forbidden, Unauthorized } from '../error/error.js'
import {
  AuthenticationCredential,
  AuthenticationOptions,
  Principal,
  UserVerification,
} from '../schema/schema.js'

/* Requests & Responses */

/* Options */
export class OptionsRes extends S.Class<OptionsRes>('@auth/OptionsRes')({
  session: S.string,
  publicKey: AuthenticationOptions,
}) {}

export class OptionsReq extends S.TaggedRequest<OptionsReq>()(
  '@auth/OptionsReq',
  BadRequest,
  OptionsRes,
  {
    userVerification: S.optional(UserVerification, { exact: true }),
  },
) {}
/** // Options */

/* Verification */
export class VerificationRes extends S.Class<VerificationRes>('@auth/VerificationRes')({
  principal: Principal,
}) {}

export const VerificationErrors = S.union(BadRequest, Unauthorized, Forbidden, Disabled)

export type VerificationErrors = S.Schema.Type<typeof VerificationErrors>

export class VerificationReq extends S.TaggedRequest<VerificationReq>()(
  '@auth/VerificationReq',
  VerificationErrors,
  VerificationRes,
  {
    session: S.string,
    credential: AuthenticationCredential,
  },
) {}
/* // Verification */

/** Router operations */
export type AuthenticationOps = {
  getAuthenticationOptions: (req: OptionsReq) => E.Effect<OptionsRes, BadRequest>
  verifyAuthenticationCredential: (
    req: VerificationReq,
  ) => E.Effect<VerificationRes, VerificationErrors>
}

/** The server should implement this interface */
export class AuthenticationHandler extends Context.Tag('@auth/AuthenticationHandler')<
  AuthenticationHandler,
  AuthenticationOps
>() {}

/** Depends on an AuthenticationHandler to actually do the work  */
export const AuthenticationRouter = Router.make(
  Rpc.effect(OptionsReq, req =>
    pipe(
      AuthenticationHandler,
      E.flatMap(handler => handler.getAuthenticationOptions(req)),
    ),
  ),
  Rpc.effect(VerificationReq, req =>
    pipe(
      AuthenticationHandler,
      E.flatMap(handler => handler.verifyAuthenticationCredential(req)),
    ),
  ),
)
