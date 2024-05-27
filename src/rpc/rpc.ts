import { toClient } from '@effect/rpc/Resolver'
import { make as makeEffect } from '@effect/rpc/ResolverNoStream'
import * as Router from '@effect/rpc/Router'
import { Context, Effect as E, Layer, RequestResolver, pipe } from 'effect'

import { BadRequest, NetworkError } from '../error/error.js'
import { AuthenticationHandler, AuthenticationRouter, type AuthenticationOps } from './authentication.js'
import { RetrySchedule, RpcConfig } from './config.js'
import { ConnectionHandler, PreConnectReq, PreConnectRouter, type PreConnectOps } from './connection.js'
import { RegistrationHandler, RegistrationRouter, type RegistrationOps } from './registration.js'
import { SocialHandler, SocialRouter, type SocialOps } from './social.js'
import { UserHandler, UserRouter, type UserOps } from './user.js'

/** Aggregates all the routes */
const router = Router.make(
  PreConnectRouter, 
  UserRouter, 
  RegistrationRouter, 
  AuthenticationRouter, 
  SocialRouter
)

/* Services */

/** To send the JSON to the backend */
export class Dispatcher extends Context.Tag('@rpc/Dispatcher')<
  Dispatcher,
  {
    get: (path: string) => E.Effect<object, NetworkError>
    post: (path: string, body: string) => E.Effect<object, NetworkError>
  }
>() {}

/** Fires off requests using a Dispatcher */
export const dispatchResolver = makeEffect(u => {
  return E.gen(function* (_) {
    const dispatcher = yield* _(Dispatcher)

    const requestBody = yield* _(
      E.try({
        try: () => JSON.stringify(u),
        catch: () => new NetworkError({ message: 'Unable to serialize RPC request' }),
      }),
    )

    return yield* _(dispatcher.post('/rpc', requestBody))
  })
})<typeof router>()

/** Fires off client requests using fetch */
/** TODO: Write tests */
/** TODO: Evaluate platform/http client (if now stable) */
export const DispatcherLive = Layer.effect(
  Dispatcher,
  E.gen(function* (_) {
    const { schedule } = yield* _(RetrySchedule)
    const { tenancyId, clientId, endpoint: maybeEndpoint } = yield* _(RpcConfig)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parseJson = (res: Response, url: string) =>
      E.tryPromise({
        try: () => res.json() as Promise<unknown>,
        catch: e =>
          new NetworkError({
            message: 'Unable to extract json response from ' + url,
            detail: String(e),
          }),
      })

    // 400 errors are reflected in the RPC response error channel
    // so in network terms they're still "ok"
    const assertNo500s = (res: Response, url: string) => {
      if (res.status >= 500) {
        return E.fail(
          new NetworkError({
            message: 'Received 500 response code from ' + url,
          }),
        )
      } else return E.void
    }

    const parseJsonObject = (json: unknown) => {
      return typeof json === 'object' && json !== null
        ? E.succeed(json)
        : E.fail(
            new NetworkError({
              message: `Expected JSON object to be returned from RPC endpoint, actual ${typeof json}`,
            }),
          )
    }

    const buildUrl = (_path: string) => {
      const endpoint = maybeEndpoint || 'https://api.passlock.dev'
      // drop leading /
      const path = _path.replace(/^\//, '')
      return `${endpoint}/${tenancyId}/${path}`
    }

    return {
      get: (path: string) => {
        const effect = E.gen(function* (_) {
          const headers = {
            'Accept': 'application/json',
            'X-CLIENT-ID': clientId,
          }

          const url = buildUrl(path)

          const res = yield* _(
            E.tryPromise({
              try: () => fetch(url, { method: 'GET', headers }),
              catch: e =>
                new NetworkError({ message: 'Unable to fetch from ' + url, detail: String(e) }),
            }),
          )

          const json = yield* _(parseJson(res, url))
          yield* _(assertNo500s(res, url))
          const jsonObject = yield* _(parseJsonObject(json))

          return jsonObject
        })

        return E.retry(effect, { schedule })
      },

      post: (_path: string, body: string) => {
        const effect = E.gen(function* (_) {
          const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CLIENT-ID': clientId,
          }

          // drop leading /
          const url = buildUrl(_path)

          const res = yield* _(
            E.tryPromise({
              try: () => fetch(url, { method: 'POST', headers, body }),
              catch: e =>
                new NetworkError({ message: 'Unable to fetch from ' + url, detail: String(e) }),
            }),
          )

          const json = yield* _(parseJson(res, url))
          yield* _(assertNo500s(res, url))
          const jsonObject = yield* _(parseJsonObject(json))

          return jsonObject
        })

        return E.retry(effect, { schedule })
      },
    }
  })
)

/* RPC Server */

export class RpcServer extends Context.Tag('@rpc/RpcServer')<RpcServer, {
  /**
   * Express or API gateway lambdas plugs into this. Usage:
   *
   * 1. Endpoint parses incoming request into a json object
   * 2. Call this handler, passing the object
   * 3. Serialize the response and send it back over the wire
   */
  handleRequest: (message: object) => E.Effect<readonly Router.Router.ResponseEffect[], BadRequest>
}>() {}

export type Handlers = ConnectionHandler | UserHandler | RegistrationHandler | AuthenticationHandler | SocialHandler

const handler = Router.toHandlerEffect(router)

const handleRequest = (message: object) =>
  pipe(
    handler(message),
    E.mapError(e => new BadRequest({ message: 'Unable to parse request', detail: String(e) })),
  )

export const RpcServerLive = Layer.effect(
  RpcServer,
  E.gen(function* (_) {
    const context = yield* _(E.context<Handlers>())

    return {
      handleRequest: (message) => pipe(handleRequest(message), E.provide(context))
    }
  })
)

/* RPC Client */

export type RouterOps = PreConnectOps & UserOps & RegistrationOps & AuthenticationOps & SocialOps

export class RpcClient extends Context.Tag('@rpc/RpcClient')<RpcClient, RouterOps>() {}

export const makeClient = (context: Context.Context<Dispatcher>) => {
  return E.sync(() =>
    pipe(RequestResolver.provideContext(dispatchResolver, context), resolver => toClient(resolver)),
  )
}

export const RpcClientLive = Layer.effect(
  RpcClient,
  E.gen(function* (_) {
    const context = yield* _(E.context<Dispatcher>())
    const client = makeClient(context)

    return {
      preConnect: () => E.flatMap(client, c => c(new PreConnectReq({}))),
      isExistingUser: req => E.flatMap(client, c => c(req)),
      verifyEmail: req => E.flatMap(client, c => c(req)),
      getRegistrationOptions: req => E.flatMap(client, c => c(req)),
      verifyRegistrationCredential: req => E.flatMap(client, c => c(req)),
      getAuthenticationOptions: req => E.flatMap(client, c => c(req)),
      verifyAuthenticationCredential: req => E.flatMap(client, c => c(req)),
      registerOidc: req => E.flatMap(client, c => c(req)),
      authenticateOidc: req => E.flatMap(client, c => c(req)),
      resendVerificationEmail: req => E.flatMap(client, c => c(req))
    }
  })
)
