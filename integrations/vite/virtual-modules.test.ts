import { candidate, css, fetchStyles, html, retryAssertion, test, ts, txt } from '../utils'

const WORKSPACE = {
  'package.json': txt`
      {
        "type": "module",
        "dependencies": {
          "@tailwindcss/vite": "workspace:^",
          "tailwindcss": "workspace:^"
        },
        "devDependencies": {
          "vite": "^5.3.5"
        }
      }
    `,
  'vite.config.ts': ts`
    import tailwindcss from '@tailwindcss/vite'
    import { defineConfig } from 'vite'
    import { fileURLToPath } from 'node:url'

    export default defineConfig({
      build: { cssMinify: false },
      plugins: [tailwindcss(), virtualModule()],
    })

    function virtualModule() {
      const virtualModuleId = 'virtual:my-module.css'
      const resolvedVirtualModuleId = ' ' + virtualModuleId

      return {
        name: 'my-plugin',
        resolveId(id) {
          if (id === virtualModuleId) {
            return resolvedVirtualModuleId
          }
        },
        load(id) {
          if (id === resolvedVirtualModuleId) {
            return 'export default {}'
          }
        },
      }
    }
  `,
  'index.html': html`
      <head>
      <link rel="stylesheet" href="./src/index.css" />
      <script type="module" src="./src/index.js"></script>
    </head>
    <body>
      <div class="underline">Hello, world!</div>
    </body>
  `,
  'src/index.js': ts`import 'virtual:my-module.css'`,
  'src/index.css': css`@import 'tailwindcss';`,
}

test(
  'does not crash when importing a virtual module ending in .css in production builds',
  { fs: WORKSPACE },
  async ({ fs, exec, expect }) => {
    await exec('pnpm vite build')

    let files = await fs.glob('dist/**/*.css')
    expect(files).toHaveLength(1)
    let [filename] = files[0]

    await fs.expectFileToContain(filename, [candidate`underline`])
  },
)

test('loads virtual modules in dev mode', { fs: WORKSPACE }, async ({ spawn, expect }) => {
  let process = await spawn('pnpm vite dev')
  await process.onStdout((m) => m.includes('ready in'))

  let url = ''
  await process.onStdout((m) => {
    let match = /Local:\s*(http.*)\//.exec(m)
    if (match) url = match[1]
    return Boolean(url)
  })

  await retryAssertion(async () => {
    let styles = await fetchStyles(url, '/index.html')
    expect(styles).toContain(candidate`underline`)
  })
})
