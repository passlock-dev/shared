import * as Resolver from '@effect/rpc/Resolver'
import * as Router from '@effect/rpc/Router'
import { Context, Effect as E, Layer, RequestResolver, Schedule, pipe } from 'effect'

import { type AuthenticationOpts, AuthenticationRouter } from './authentication'
import { type PreConnectOps, PreConnectReq, PreConnectRouter } from './connection'
import { type RegistrationOps, RegistrationRouter } from './registration'
import { type UserOps, UserRouter } from './user'
import { BadRequest, NetworkError } from '../error/error'

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
export class NetworkService extends Context.Tag('NetworkService')<
  NetworkService,
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

/** API gateway plugs into this.
 * Indirectly, it requires the handlers */
export const rpcHandler = (message: object) =>
  pipe(
    Router.toHandlerEffect(router),
    handler => handler(message),
    E.mapError(e => new BadRequest({ message: 'Unable to parse request', detail: String(e) })),
  )

/** Fires off requests using a NetworkService */
export const networkResolver = Resolver.makeEffect(u => {
  return E.gen(function* (_) {
    const networkService = yield* _(NetworkService)

    const requestBody = yield* _(
      E.try({
        try: () => JSON.stringify(u),
        catch: () => new NetworkError({ message: 'Unable to serialize RPC request' }),
      }),
    )

    return yield* _(networkService.post('/rpc', requestBody))
  })
})<typeof router>()

/** Fires off client requests using fetch */
export const NetworkServiceLive = Layer.effect(
  NetworkService,
  E.gen(function* (_) {
    const { schedule } = yield* _(RetrySchedule)
    const { tenancyId, clientId, endpoint: maybeEndpoint } = yield* _(RpcConfig)

    return {
      get: (_path: string) => {
        const effect = E.gen(function* (_) {
          const endpoint = maybeEndpoint || 'https://api.passlock.dev'

          const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CLIENT-ID': clientId,
          }

          // drop leading /
          const path = _path.replace(/^\//, '')
          const url = `${endpoint}/${tenancyId}/${path}`

          const res = yield* _(
            E.tryPromise({
              try: () => fetch(url, { method: 'GET', headers }),
              catch: e =>
                new NetworkError({ message: 'Unable to fetch from ' + url, detail: String(e) }),
            }),
          )

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const json = yield* _(
            E.tryPromise({
              try: () => res.json() as Promise<unknown>,
              catch: e =>
                new NetworkError({
                  message: 'Unable to extract json response from ' + url,
                  detail: String(e),
                }),
            }),
          )

          if (res.status >= 500)
            yield* _(
              new NetworkError({
                message: 'Received 500 response code from ' + url,
              }),
            )

          const jsonObject = yield* _(
            typeof json === 'object' && json !== null
              ? E.succeed(json)
              : E.fail(
                  new NetworkError({
                    message: `Expected JSON object to be returned from RPC endpoint, actual ${typeof json}`,
                  }),
                ),
          )

          return jsonObject
        })

        return E.retry(effect, { schedule })
      },

      post: (_path: string, body: string) => {
        const effect = E.gen(function* (_) {
          const endpoint = maybeEndpoint || 'https://api.passlock.dev'

          const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CLIENT-ID': clientId,
          }

          // drop leading /
          const path = _path.replace(/^\//, '')
          const url = `${endpoint}/${tenancyId}/${path}`

          const res = yield* _(
            E.tryPromise({
              try: () => fetch(url, { method: 'POST', headers, body }),
              catch: e =>
                new NetworkError({ message: 'Unable to fetch from ' + url, detail: String(e) }),
            }),
          )

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const json = yield* _(
            E.tryPromise({
              try: () => res.json() as Promise<unknown>,
              catch: e =>
                new NetworkError({
                  message: 'Unable to extract json response from ' + url,
                  detail: String(e),
                }),
            }),
          )

          if (res.status >= 500)
            yield* _(
              new NetworkError({
                message: 'Received 500 response code from ' + url,
              }),
            )

          const jsonObject = yield* _(
            typeof json === 'object' && json !== null
              ? E.succeed(json)
              : E.fail(
                  new NetworkError({
                    message: `Expected JSON object to be returned from RPC endpoint, actual ${typeof json}`,
                  }),
                ),
          )

          return jsonObject
        })

        return E.retry(effect, { schedule })
      },
    }
  }),
)

export const makeClient = (context: Context.Context<NetworkService>) =>
  E.sync(() =>
    pipe(RequestResolver.provideContext(networkResolver, context), resolver =>
      Resolver.toClient(resolver),
    ),
  )

export type RouterOps = PreConnectOps & UserOps & RegistrationOps & AuthenticationOpts

export class RpcClient extends Context.Tag('RpcClient')<RpcClient, RouterOps>() {}

export const RpcClientLive = Layer.effect(
  RpcClient,
  E.gen(function* (_) {
    const context = yield* _(E.context<NetworkService>())
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
