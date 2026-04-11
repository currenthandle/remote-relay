import { Context, Effect, Layer, Stream } from "effect"

const findPlayer = (): string[] => {
  if (process.platform === "darwin") {
    if (Bun.spawnSync(["which", "mpv"]).exitCode === 0)
      return ["mpv", "--no-video", "--demuxer=lavf", "-"]
    if (Bun.spawnSync(["which", "ffplay"]).exitCode === 0)
      return ["ffplay", "-nodisp", "-autoexit", "-"]
    // afplay doesn't support stdin, but it's the last resort on macOS
    return ["afplay", "-"]
  }
  // Linux: try mpv, ffplay, mpg123 in order
  const candidates: [string, ...string[]][] = [
    ["mpv", "--no-video", "--demuxer=lavf", "-"],
    ["ffplay", "-nodisp", "-autoexit", "-"],
    ["mpg123", "-q", "-"],
  ]
  for (const player of candidates) {
    const result = Bun.spawnSync(["which", player[0]])
    if (result.exitCode === 0) return player
  }
  return ["mpv", "--no-video", "--demuxer=lavf", "-"]
}

const playerCmd = findPlayer()
console.log(`Audio player: ${playerCmd[0]}`)

export class AudioPlayer extends Context.Tag("AudioPlayer")<
  AudioPlayer,
  { readonly play: (stream: Stream.Stream<Uint8Array, unknown>) => Effect.Effect<void> }
>() {
  static Live = Layer.succeed(AudioPlayer, {
    play: (stream: Stream.Stream<Uint8Array, unknown>) =>
      Effect.gen(function* () {
        const proc = Bun.spawn(playerCmd, { stdin: "pipe", stderr: "pipe" })

        // Stream chunks directly to player's stdin as they arrive
        yield* Stream.runForEach(stream, (chunk) =>
          Effect.sync(() => proc.stdin.write(chunk))
        ).pipe(
          Effect.catchAll((err) =>
            Effect.logWarning(`Stream error: ${err}`)
          )
        )
        proc.stdin.flush()
        proc.stdin.end()

        yield* Effect.promise(() => proc.exited)

        if (proc.exitCode !== 0) {
          const stderr = yield* Effect.promise(() => new Response(proc.stderr).text())
          yield* Effect.logWarning(`Audio player exited ${proc.exitCode}: ${stderr}`)
        }
      }),
  })
}
