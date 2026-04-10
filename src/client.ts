import { mkdirSync } from "node:fs"
import { join } from "node:path"

const RELAY_URL = process.env.RELAY_URL ?? "http://localhost:8877"
const OUTPUT_DIR = process.env.RELAY_OUTPUT ?? join(process.env.HOME ?? "/tmp", "relay-files")

mkdirSync(OUTPUT_DIR, { recursive: true })

console.log(`Subscribing to ${RELAY_URL}/events`)
console.log(`Saving files to ${OUTPUT_DIR}`)

async function connect() {
  const response = await fetch(`${RELAY_URL}/events`)
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const messages = buffer.split("\n\n")
    buffer = messages.pop() ?? ""

    for (const msg of messages) {
      const lines = msg.split("\n")
      const eventLine = lines.find((l) => l.startsWith("event: "))
      const dataLine = lines.find((l) => l.startsWith("data: "))
      if (!eventLine || !dataLine) continue

      const eventType = eventLine.slice(7)
      const data = JSON.parse(dataLine.slice(6))

      if (eventType === "file") {
        const bytes = Buffer.from(data.data, "base64")
        const outPath = join(OUTPUT_DIR, data.name)
        await Bun.write(outPath, bytes)
        console.log(`Received: ${data.name} (${bytes.length} bytes) → ${outPath}`)
      }
    }
  }
}

while (true) {
  try {
    await connect()
    console.log("Connection closed, reconnecting...")
  } catch (e) {
    console.log(`Connection lost (${(e as Error).name}), reconnecting in 1s...`)
    await Bun.sleep(1000)
  }
}
