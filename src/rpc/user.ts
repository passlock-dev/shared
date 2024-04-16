import { Router } from '@effect/rpc'
import * as Rpc from '@effect/rpc/Rpc'
import * as S from '@effect/schema/Schema'
import { Context, Effect as E, pipe } from 'effect'

import { Principal, VerifyEmail } from '../schema/schema.js'

import { BadRequest, Disabled, Forbidden, NotFound, Unauthorized } from '../error/error.js'

/* Requests & Responses */

/* Registration status */
export class IsExistingUserRes extends S.Class<IsExistingUserRes>('@user/IsExistingUserRes')({
  existingUser: S.Boolean,
  detail: S.optional(S.String),
}) {}

export class IsExistingUserReq extends S.TaggedRequest<IsExistingUserReq>()(
  '@user/IsExistingUserReq',
  BadRequest,
  IsExistingUserRes,
  {
    email: S.String,
  },
) {}

/* Verify email */
export class VerifyEmailRes extends S.Class<VerifyEmailRes>('@user/VerifyEmailRes')({
  principal: Principal,
}) {}

export const VerifyEmailErrors = S.Union(BadRequest, NotFound, Disabled, Unauthorized, Forbidden)

export type VerifyEmailErrors = S.Schema.Type<typeof VerifyEmailErrors>

export class VerifyEmailReq extends S.TaggedRequest<VerifyEmailReq>()(
  '@user/VerifyEmailReq',
  VerifyEmailErrors,
  VerifyEmailRes,
  {
    code: S.String,
    token: S.String,
  },
) {}

/* Resend verification email */
export class ResendEmailRes extends S.Class<ResendEmailRes>('@user/ResendEmailRes')({ }) {}

export const ResendEmailErrors = S.Union(BadRequest, NotFound, Disabled)

export type ResendEmailErrors = S.Schema.Type<typeof ResendEmailErrors>

export class ResendEmailReq extends S.TaggedRequest<ResendEmailReq>()(
  '@user/ResendEmailReq',
  ResendEmailErrors,
  ResendEmailRes,
  {
    userId: S.String,
    verifyEmail: VerifyEmail,
  },
) {}

/** Router operations */
export type UserOps = {
  isExistingUser: (req: IsExistingUserReq) => E.Effect<IsExistingUserRes, BadRequest>
  verifyEmail: (req: VerifyEmailReq) => E.Effect<VerifyEmailRes, VerifyEmailErrors>
  resendVerificationEmail: (req: ResendEmailReq) => E.Effect<ResendEmailRes, ResendEmailErrors>
}

/** The server should implement this interface */
export class UserHandler extends Context.Tag('@user/UserHandler')<UserHandler, UserOps>() {}

/** Depends on a UserHandler to actually do the work  */
export const UserRouter = Router.make(
  Rpc.effect(IsExistingUserReq, req =>
    pipe(
      UserHandler,
      E.flatMap(handler => handler.isExistingUser(req)),
    ),
  ),
  Rpc.effect(VerifyEmailReq, req =>
    pipe(
      UserHandler,
      E.flatMap(handler => handler.verifyEmail(req)),
    ),
  ),
  Rpc.effect(ResendEmailReq, req =>
    pipe(
      UserHandler,
      E.flatMap(handler => handler.resendVerificationEmail(req)),
    ),
  ),
)
