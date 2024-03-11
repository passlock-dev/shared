# RPC operations

There are a few components in play here:

## Service specific components

UserHandler / RegistrationHandler etc - Tagged services responsible for actually performing the work. The signature looks something like `isUserRegistered: (...) => E.Effect<IsRegisteredRes, BadRequest>`

UserRouter / RegistrationRouter etc - Routes requests to the relevant handler e.g. UserHandler

## Generic components

RpcHandler - Wraps the various service specific handlers. Express/Lambda plugs into this
RpcClient - Wraps the various service specific routers to expose a unified facade

## Internals

Router - Wraps the various service specific routers
Dispatcher - Used by the RpcClient to fire off requests over the network