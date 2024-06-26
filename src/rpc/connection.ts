import { Router } from '@effect/rpc'
import * as Rpc from '@effect/rpc/Rpc'
import * as S from '@effect/schema/Schema'
import { Context, Effect as E, pipe } from 'effect'

/* Requests & Responses */
export class PreConnectRes extends S.Class<PreConnectRes>('@connection/PreConnectRes')({
  warmed: S.Boolean,
}) {}

export class PreConnectReq extends S.TaggedRequest<PreConnectReq>()(
  '@connection/PreConnectReq',
  S.Never,
  PreConnectRes,
  {},
) {}

/** Router operations */
export type PreConnectOps = {
  preConnect: (req: PreConnectReq) => E.Effect<PreConnectRes>
}

/** The server should implement this interface */
export class ConnectionHandler extends Context.Tag('@connection/PreConnectHandler')<
  ConnectionHandler,
  PreConnectOps
>() {}

/** Depends on an AuthenticationHandler to actually do the work  */
export const PreConnectRouter = Router.make(
  Rpc.effect(PreConnectReq, req =>
    pipe(
      ConnectionHandler,
      E.flatMap(handler => handler.preConnect(req)),
    ),
  ),
)
