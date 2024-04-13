import { Router } from '@effect/rpc'
import * as Rpc from '@effect/rpc/Rpc'
import * as S from '@effect/schema/Schema'
import { Context, Effect as E, pipe } from 'effect'

import { Principal } from '../schema/schema.js'

import { BadRequest, Disabled, Forbidden, NotFound, Unauthorized } from '../error/error.js'

/* Requests & Responses */

/* Registration status */
export class IsExistingUserRes extends S.Class<IsExistingUserRes>('user.isExistingUserRes')({
  existingUser: S.boolean,
  detail: S.optional(S.string),
}) {}

export class IsExistingUserReq extends S.TaggedRequest<IsExistingUserReq>()(
  'user.isExistingUserReq',
  BadRequest,
  IsExistingUserRes,
  {
    email: S.string,
  },
) {}

/* Verify email */
export class VerifyEmailRes extends S.Class<VerifyEmailRes>('user.verifyEmailRes')({
  principal: Principal,
}) {}

export const VerifyEmailErrors = S.union(BadRequest, NotFound, Disabled, Unauthorized, Forbidden)

export type VerifyEmailErrors = S.Schema.Type<typeof VerifyEmailErrors>

export class VerifyEmailReq extends S.TaggedRequest<VerifyEmailReq>()(
  'user.verifyEmailReq',
  VerifyEmailErrors,
  VerifyEmailRes,
  {
    code: S.string,
    token: S.string,
  },
) {}

/** Router operations */
export type UserOps = {
  isExistingUser: (req: IsExistingUserReq) => E.Effect<IsExistingUserRes, BadRequest>
  verifyEmail: (req: VerifyEmailReq) => E.Effect<VerifyEmailRes, VerifyEmailErrors>
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
)
