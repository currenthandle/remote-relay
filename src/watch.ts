import { watch } from "node:fs"
import { readFile } from "node:fs/promises"
import { join, basename } from "node:path"
import { lookup } from "node:dns"

const RELAY_URL = process.env.RELAY_URL ?? "http://localhost:8877"
const WATCH_DIR = process.argv[2] ?? process.env.WATCH_DIR ?? join(process.env.HOME ?? "/tmp", "share")

console.log(`Watching ${WATCH_DIR}`)
console.log(`Pushing to ${RELAY_URL}/push`)

const seen = new Set<string>()

watch(WATCH_DIR, async (event, filename) => {
  if (!filename || event !== "rename") return
  const filepath = join(WATCH_DIR, filename)

  // Debounce: skip if we just saw this file
  if (seen.has(filename)) return
  seen.add(filename)
  setTimeout(() => seen.delete(filename), 1000)

  // Wait a moment for the file to finish writing
  await Bun.sleep(200)

  const file = Bun.file(filepath)
  if (!(await file.exists())) return

  const data = await file.arrayBuffer()
  const mimeType = file.type ?? "application/octet-stream"

  const res = await fetch(
    `${RELAY_URL}/push?name=${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: data,
    }
  )

  if (res.ok) {
    console.log(`Pushed: ${filename} (${data.byteLength} bytes)`)
  } else {
    console.error(`Failed to push ${filename}: ${res.status}`)
  }
})
