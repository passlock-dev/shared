import { Router } from '@effect/rpc'
import * as Rpc from '@effect/rpc/Rpc'
import * as S from '@effect/schema/Schema'
import { Context, Effect as E, pipe } from 'effect'

import { BadRequest, Disabled, Duplicate, Forbidden, NotFound, Unauthorized } from '../error/error.js'
import {
  Principal
} from '../schema/schema.js'

const Provider = S.Literal('apple', 'google')

/* Registration requests & responses */
export class PrincipalRes extends S.Class<PrincipalRes>('@social/PrincipalRes')({ principal: Principal }) {}

export const RegisterOidcErrors = S.Union(BadRequest, Unauthorized, Forbidden, Disabled, Duplicate)

export type RegisterOidcErrors = S.Schema.Type<typeof RegisterOidcErrors>

const RegisterOidcPayload = S.Struct({
  provider: Provider,
  idToken: S.String,
  givenName: S.Option(S.String),
  familyName: S.Option(S.String),
  nonce: S.String,
})

export type RegisterOidcPayload = S.Schema.Type<typeof RegisterOidcPayload>

export class RegisterOidcReq extends S.TaggedRequest<RegisterOidcReq>()(
  '@social/RegisterOidcReq',
  RegisterOidcErrors,
  PrincipalRes,
  RegisterOidcPayload['fields']
) {}

/* Authentication requests & responses */
export const AuthOidcErrors = S.Union(BadRequest, Unauthorized, Forbidden, Disabled, NotFound)

export type AuthOidcErrors = S.Schema.Type<typeof AuthOidcErrors>

const AuthOidcPayload = S.Struct({
  provider: Provider,
  idToken: S.String,
  nonce: S.String,
})

export type AuthOidcPayload = S.Schema.Type<typeof AuthOidcPayload>

export class AuthOidcReq extends S.TaggedRequest<AuthOidcReq>()(
  '@social/AuthOidcReq',
  AuthOidcErrors,
  PrincipalRes,
  AuthOidcPayload['fields']
) {}


/** Router operations */
export type SocialOps = {
  registerOidc: (
    req: RegisterOidcReq,
  ) => E.Effect<PrincipalRes, RegisterOidcErrors>

  authenticateOidc: (
    req: AuthOidcReq,
  ) => E.Effect<PrincipalRes, AuthOidcErrors>
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
  Rpc.effect(AuthOidcReq, req =>
    pipe(
      SocialHandler,
      E.flatMap(handler => handler.authenticateOidc(req)),
    ),
  ),
)
