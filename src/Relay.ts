import { Context, Effect, Layer, PubSub } from "effect"

export type RelayEvent = {
  readonly _tag: "file"
  readonly name: string
  readonly data: string // base64
  readonly mimeType: string
}

export class Relay extends Context.Tag("Relay")<
  Relay,
  { readonly pubsub: PubSub.PubSub<RelayEvent> }
>() {
  static Live = Layer.effect(
    Relay,
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<RelayEvent>()
      return { pubsub }
    })
  )
}
