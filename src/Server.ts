import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Effect, PubSub, Schedule, Stream } from "effect"
import { Relay, type RelayEvent } from "./Relay.js"
import { AudioPlayer } from "./AudioPlayer.js"

const encoder = new TextEncoder()

const encodeSSE = (event: RelayEvent): Uint8Array => {
  const text = `event: ${event._tag}\ndata: ${JSON.stringify(event)}\n\n`
  return encoder.encode(text)
}

const sseHandler = Effect.gen(function* () {
  const { pubsub } = yield* Relay

  const keepalive = encoder.encode(": keepalive\n\n")
  const stream = Stream.merge(
    Stream.concat(
      Stream.make(keepalive),
      Stream.fromSchedule(Schedule.spaced("30 seconds")).pipe(Stream.map(() => keepalive))
    ),
    Stream.fromPubSub(pubsub).pipe(Stream.map(encodeSSE))
  )

  return HttpServerResponse.stream(stream, {
    contentType: "text/event-stream",
    headers: {
      "cache-control": "no-cache",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  })
})

const audioHandler = Effect.gen(function* () {
  const req = yield* HttpServerRequest.HttpServerRequest
  const player = yield* AudioPlayer
  yield* player.play(req.stream)
  return yield* HttpServerResponse.json({ ok: true })
})

const pushHandler = Effect.gen(function* () {
  const { pubsub } = yield* Relay
  const req = yield* HttpServerRequest.HttpServerRequest
  const body = yield* req.arrayBuffer
  const url = new URL(req.url, "http://localhost")
  const name = url.searchParams.get("name") ?? `file-${Date.now()}`
  const contentType =
    (req.headers as Record<string, string>)["content-type"] ??
    "application/octet-stream"
  const data = Buffer.from(body).toString("base64")
  yield* PubSub.publish(pubsub, { _tag: "file" as const, name, data, mimeType: contentType })
  return yield* HttpServerResponse.json({ ok: true, name })
})

export const router = HttpRouter.empty.pipe(
  HttpRouter.get("/events", sseHandler),
  HttpRouter.post("/audio", audioHandler),
  HttpRouter.post("/push", pushHandler)
)
