import { Router, Rpc } from '@effect/rpc'
import type { Schema } from '@effect/schema'
import { Context, Effect as E, Layer, LogLevel, Logger, Option as O, Ref, pipe } from 'effect'
import { assert, describe, expect, test } from 'vitest'

import { NetworkService, RpcClient, RpcClientLive } from './rpc'
import { IsExistingUserReq, IsExistingUserRes } from './user'
import { BadRequest, NetworkError } from '../error/error'

const makeHandler = <Req extends Schema.TaggedRequest.Any>(rpc: Rpc.Rpc<Req, never>) =>
  E.sync(() => {
    const router = Router.make(rpc)
    return Router.toHandlerEffect(router)
  })

export const testNetworkService = <Req extends Schema.TaggedRequest.Any>(
  rpc: Rpc.Rpc<Req, never>,
) => ({
  get: () =>
    E.succeed({
      /* empty object */
    }),
  post: (_: string, body: string) =>
    pipe(
      makeHandler(rpc),
      E.zip(E.succeed(JSON.parse(body))),
      E.flatMap(([handler, body]) => handler(body)),
      E.orDie,
    ),
})

describe('RPC client', () => {
  test('should pass requests onto the handler', async () => {
    const State = Context.GenericTag<Ref.Ref<{ req: O.Option<IsExistingUserReq> }>>('@test/State')

    const assertions = E.gen(function* (_) {
      const state = yield* _(State)
      const rpcClient = yield* _(RpcClient)

      const sentRequest = new IsExistingUserReq({ email: 'toby@passlock.dev' })
      const response = yield* _(rpcClient.isExistingUser(sentRequest))
      expect(response.existingUser).toBe(true)

      // what the handler actually received
      const receivedRequest = yield* _(
        Ref.get(state),
        E.map(state => state.req),
        E.map(O.getOrThrow),
      )

      assert.deepStrictEqual(receivedRequest, sentRequest)
    })

    const respond = (req: IsExistingUserReq) =>
      pipe(
        State,
        // store the received request for later assertions
        E.flatMap(Ref.set({ req: O.some(req) })),
        E.as(new IsExistingUserRes({ existingUser: true })),
      )

    const rpc = Rpc.effect(IsExistingUserReq, respond)

    const networkServiceTest = Layer.effect(
      NetworkService,
      pipe(
        State,
        E.map(state => Rpc.provideService(rpc, State, state)),
        E.map(rpc => testNetworkService(rpc)),
      ),
    )

    const liveClient = pipe(RpcClientLive, Layer.provide(networkServiceTest))

    const initState = {
      req: O.none<IsExistingUserReq>(),
    }

    const effect = pipe(
      assertions,
      E.provide(liveClient),
      E.provideServiceEffect(State, Ref.make(initState)),
      Logger.withMinimumLogLevel(LogLevel.None),
    )

    await E.runPromise(effect)
  })

  test('should propagate backend errors', async () => {
    const badRequest = new BadRequest({ message: 'Invalid email' })

    const assertions = E.gen(function* (_) {
      const rpcClient = yield* _(RpcClient)

      const sentRequest = new IsExistingUserReq({ email: 'toby' })
      const response = yield* _(E.either(rpcClient.isExistingUser(sentRequest)), E.flatMap(E.flip))

      assert.deepStrictEqual(response, badRequest)
    })

    const respond = () => E.fail(badRequest)
    const rpc = Rpc.effect(IsExistingUserReq, respond)
    const networkService = Layer.succeed(NetworkService, testNetworkService(rpc))
    const liveClient = pipe(RpcClientLive, Layer.provide(networkService))

    const effect = pipe(
      assertions,
      E.provide(liveClient),
      Logger.withMinimumLogLevel(LogLevel.None),
    )

    await E.runPromise(effect)
  })

  describe('when the endpoint fails', () => {
    test('should die with a NetworkError', async () => {
      const assertions = E.gen(function* (_) {
        const rpcClient = yield* _(RpcClient)
        const sentRequest = new IsExistingUserReq({ email: 'toby' })

        const defect = yield* _(
          rpcClient.isExistingUser(sentRequest),
          E.catchAllDefect(defect => E.succeed(defect)),
        )

        assert.instanceOf(defect, NetworkError)
      })

      const testNetworkService = {
        get: () => E.fail(new NetworkError({ message: 'BOOM!' })),
        post: () => E.fail(new NetworkError({ message: 'BOOM!' })),
      }

      const networkService = Layer.succeed(NetworkService, testNetworkService)
      const liveClient = pipe(RpcClientLive, Layer.provide(networkService))

      const effect = pipe(
        assertions,
        E.provide(liveClient),
        Logger.withMinimumLogLevel(LogLevel.None),
      )

      await E.runPromise(effect)
    })
  })
})
