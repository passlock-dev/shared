import { Router } from '@effect/rpc'
import * as Rpc from '@effect/rpc/Rpc'
import * as S from '@effect/schema/Schema'
import { Context, Effect as E, pipe } from 'effect'

/* Requests & Responses */
export class PreConnectRes extends S.Class<PreConnectRes>()({ warmed: S.boolean }) {}

export class PreConnectReq extends S.TaggedRequest<PreConnectReq>()(
  'preconnect',
  S.never,
  PreConnectRes,
  {},
) {}

/** Router operations */
export type PreConnectOps = {
  preConnect: (req: PreConnectReq) => E.Effect<PreConnectRes>
}

/** The server should implement this interface */
export class ConnectionHandler extends Context.Tag('PreConnectHandler')<
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
