import { Context, Effect, Layer } from "effect"

export class AudioPlayer extends Context.Tag("AudioPlayer")<
  AudioPlayer,
  { readonly play: (data: Uint8Array) => Effect.Effect<void> }
>() {
  static Live = Layer.succeed(AudioPlayer, {
    play: (data: Uint8Array) =>
      Effect.gen(function* () {
        const tmp = `/tmp/relay-${Date.now()}.mp3`
        yield* Effect.promise(() => Bun.write(tmp, data))
        const cmd =
          process.platform === "darwin"
            ? ["afplay", tmp]
            : ["mpv", "--no-video", tmp]
        yield* Effect.promise(() => {
          const proc = Bun.spawn(cmd)
          return proc.exited
        })
        yield* Effect.promise(() =>
          import("node:fs/promises").then((fs) =>
            fs.unlink(tmp).catch(() => {})
          )
        )
      }),
  })
}
