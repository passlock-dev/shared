import { Router } from '@effect/rpc'
import * as Rpc from '@effect/rpc/Rpc'
import * as S from '@effect/schema/Schema'
import { Context, Effect as E, pipe } from 'effect'

import { BadRequest, Disabled, Duplicate, Forbidden, NotFound, Unauthorized } from '../error/error.js'
import {
    Principal
} from '../schema/schema.js'

/* Requests & Responses */

/* Verification */
export class OidcRes extends S.Class<OidcRes>('@social@OidcRes')({ principal: Principal }) {}

export const RegisterOidcErrors = S.Union(BadRequest, Unauthorized, Forbidden, Disabled, Duplicate)

export type RegisterOidcErrors = S.Schema.Type<typeof RegisterOidcErrors>

export class RegisterOidcReq extends S.TaggedRequest<RegisterOidcReq>()(
  '@social/RegisterOidcReq',
  RegisterOidcErrors,
  OidcRes,
  {
    provider: S.Literal('google'),
    idToken: S.String,
  },
) {}

export const AuthenticateOidcErrors = S.Union(BadRequest, Unauthorized, Forbidden, Disabled, NotFound)

export type AuthenticateOidcErrors = S.Schema.Type<typeof AuthenticateOidcErrors>

export class AuthenticateOidcReq extends S.TaggedRequest<AuthenticateOidcReq>()(
  '@social/AuthenticateOidcReq',
  AuthenticateOidcErrors,
  OidcRes,
  {
    provider: S.Literal('google'),
    idToken: S.String,
  },
) {}
/* // Verification */

/** Router operations */
export type SocialOps = {
  registerOidc: (
    req: RegisterOidcReq,
  ) => E.Effect<OidcRes, RegisterOidcErrors>

  authenticateOidc: (
    req: AuthenticateOidcReq,
  ) => E.Effect<OidcRes, AuthenticateOidcErrors>
}

/** The server should implement this interface */
export class SocialHandler extends Context.Tag('@social/Handler')<
  SocialHandler,
  SocialOps
>() {}

/** Depends on an AuthenticationHandler to actually do the work  */
export const SocialRouter = Router.make(
  Rpc.effect(RegisterOidcReq, req =>
    pipe(
      SocialHandler,
      E.flatMap(handler => handler.registerOidc(req)),
    ),
  ),
  Rpc.effect(AuthenticateOidcReq, req =>
    pipe(
      SocialHandler,
      E.flatMap(handler => handler.authenticateOidc(req)),
    ),
  ),
)
