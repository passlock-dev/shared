# RPC operations

There are a few components in play here:

## Service specific components

See authentication.ts, registration.ts etc.

*Handler - Tagged services responsible for actually performing the work on the backend.

*Router - Routes requests to the relevant handler e.g. UserHandler

## Generic components

See rpc.ts

RpcHandler - Wraps the various service specific handlers. The backend plugs into this.

RpcClient - Wraps the various service specific routers to expose a unified facade. The frontend client uses this.

Dispatcher - Responsible for actually sending requests over the wire. Basically a wrapper around fetch. We could use platform/http here.

dispatchResolver - connects the RpcClient and Dispatcher
