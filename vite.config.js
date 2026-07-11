import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Keep heavy local photo backups out of the production bundle.
// They are served from Supabase Storage; local copies are backups only.
function excludeHeavyPublicDirs(dirs = ['posters', 'photos']) {
  let outDir = 'dist'
  return {
    name: 'exclude-heavy-public',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      for (const dir of dirs) {
        const target = path.join(outDir, dir)
        if (fs.existsSync(target)) {
          fs.rmSync(target, { recursive: true, force: true })
          console.log(`[exclude-heavy-public] removed ${target}`)
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), excludeHeavyPublicDirs()],
})
