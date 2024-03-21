import * as Resolver from '@effect/rpc/Resolver'
import * as Router from '@effect/rpc/Router'
import { Context, Effect as E, Layer, RequestResolver, Schedule, pipe } from 'effect'

import { type AuthenticationOpts, AuthenticationRouter } from './authentication.js'
import { type PreConnectOps, PreConnectReq, PreConnectRouter } from './connection.js'
import { type RegistrationOps, RegistrationRouter } from './registration.js'
import { type UserOps, UserRouter } from './user.js'
import { BadRequest, NetworkError } from '../error/error.js'

/* Services */

export class RpcConfig extends Context.Tag('RpcConfig')<
  RpcConfig,
  {
    endpoint?: string
    tenancyId: string
    clientId: string
  }
>() {}

/** To send the JSON to the backend */
export class Dispatcher extends Context.Tag('Dispatcher')<
  Dispatcher,
  {
    get: (path: string) => E.Effect<object, NetworkError>
    post: (path: string, body: string) => E.Effect<object, NetworkError>
  }
>() {}

export class RetrySchedule extends Context.Tag('RetrySchedule')<
  RetrySchedule,
  {
    schedule: Schedule.Schedule<unknown>
  }
>() {}

/** Aggregates all the routes and requires all handlers */
const router = Router.make(PreConnectRouter, UserRouter, RegistrationRouter, AuthenticationRouter)

/** 
 * Express or API gateway lambdas plugs into this. Usage:
 * 
 * 1. Endpoint parses incoming request into a json object
 * 2. Call this handler, passing the object
 * 3. Serialize the response and send it over the wire
 */
export const RpcHandler = (message: object) =>
  pipe(
    Router.toHandlerEffect(router),
    handler => handler(message),
    E.mapError(e => new BadRequest({ message: 'Unable to parse request', detail: String(e) })),
  )

/** Fires off requests using a Dispatcher */
export const dispatchResolver = Resolver.makeEffect(u => {
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
export const DispatcherLive = Layer.effect(
  Dispatcher,
  E.gen(function* (_) {
    const { schedule } = yield* _(RetrySchedule)
    const { tenancyId, clientId, endpoint: maybeEndpoint } = yield* _(RpcConfig)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parseJson = (res: Response, url: string) => E.tryPromise({
      try: () => res.json() as Promise<unknown>,
      catch: e => new NetworkError({
        message: 'Unable to extract json response from ' + url,
        detail: String(e),
      }),
    })

    // 400 errors are reflected in the RPC response error channel
    // so in network terms they're still "ok"
    const assertNo500s = (res: Response, url: string) => {
      if (res.status >= 500) {
        return E.fail(new NetworkError({
          message: 'Received 500 response code from ' + url,
        })) 
      } else return E.unit
    }

    const parseJsonObject = (json: unknown) => {
      return typeof json === 'object' && json !== null
        ? E.succeed(json)
        : E.fail(
          new NetworkError({
            message: `Expected JSON object to be returned from RPC endpoint, actual ${typeof json}`,
          })
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
  }),
)

export const makeClient = (context: Context.Context<Dispatcher>) =>
  E.sync(() =>
    pipe(RequestResolver.provideContext(dispatchResolver, context), resolver =>
      Resolver.toClient(resolver),
    ),
  )

export type RouterOps = PreConnectOps & UserOps & RegistrationOps & AuthenticationOpts

export class RpcClient extends Context.Tag('RpcClient')<RpcClient, RouterOps>() {}

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
    }
  }),
)
