import { HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import * as Http from "node:http"
import { router } from "./Server.js"
import { Relay } from "./Relay.js"
import { AudioPlayer } from "./AudioPlayer.js"

const PORT = parseInt(process.env.RELAY_PORT ?? "8877", 10)

const ServerLive = NodeHttpServer.layer(
  () => Http.createServer(),
  { port: PORT }
)

const AppLive = router.pipe(
  HttpServer.serve(),
  Layer.provide(ServerLive),
  Layer.provide(Relay.Live),
  Layer.provide(AudioPlayer.Live)
)

console.log(`claude-relay starting on :${PORT}`)

AppLive.pipe(Layer.launch, NodeRuntime.runMain)
