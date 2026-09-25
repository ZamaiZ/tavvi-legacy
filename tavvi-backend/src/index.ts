import { createApp } from './app.js'
import { getServerEnv } from './config/env.js'

const env = getServerEnv()
const app = createApp(env)
const server = app.listen(env.port, '0.0.0.0', () => {
  process.stdout.write(`Tavvi Mobile API listening on port ${env.port}\n`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
