import { Router } from '@effect/rpc'
import * as Rpc from '@effect/rpc/Rpc'
import * as S from '@effect/schema/Schema'
import { Context, Effect as E, pipe } from 'effect'

import { BadRequest, Disabled, Duplicate, Forbidden, Unauthorized } from '../error/error.js'
import {
  Principal
} from '../schema/schema.js'

/* Requests & Responses */

/* Verification */
export class VerificationRes extends S.Class<VerificationRes>('@social@VerificationRes')({ principal: Principal }) {}

export const VerificationErrors = S.union(BadRequest, Unauthorized, Forbidden, Disabled, Duplicate)

export type VerificationErrors = S.Schema.Type<typeof VerificationErrors>

export class OIDCReq extends S.TaggedRequest<OIDCReq>()(
  '@social@OidcReq',
  VerificationErrors,
  VerificationRes,
  {
    provider: S.literal('google'),
    idToken: S.string,
  },
) {}
/* // Verification */

/** Router operations */
export type SocialOps = {
  verifyIdToken: (
    req: OIDCReq,
  ) => E.Effect<VerificationRes, VerificationErrors>
}

/** The server should implement this interface */
export class SocialHandler extends Context.Tag('@social/AuthenticationHandler')<
  SocialHandler,
  SocialOps
>() {}

/** Depends on an AuthenticationHandler to actually do the work  */
export const SocialRouter = Router.make(
  Rpc.effect(OIDCReq, req =>
    pipe(
      SocialHandler,
      E.flatMap(handler => handler.verifyIdToken(req)),
    ),
  ),
)
