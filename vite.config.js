import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Keep heavy local photo backups out of the production bundle while preserving active listing photos.
function pruneHeavyPublicDirs() {
  let outDir = 'dist'
  return {
    name: 'prune-heavy-public',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      for (const dir of ['posters', 'photos']) {
        const target = path.join(outDir, dir)
        if (fs.existsSync(target)) {
          fs.rmSync(target, { recursive: true, force: true })
          console.log(`[prune-heavy-public] removed ${target}`)
        }
      }

      const activeUrls = new Set()
      const collectUrls = (filePath) => {
        if (!fs.existsSync(filePath)) return
        try {
          const items = JSON.parse(fs.readFileSync(filePath, 'utf8'))
          items.forEach((item) => {
            if (item.imageUrl) activeUrls.add(item.imageUrl)
            if (Array.isArray(item.photoUrls)) item.photoUrls.forEach((u) => activeUrls.add(u))
            if (Array.isArray(item.allPhotoUrls)) item.allPhotoUrls.forEach((u) => activeUrls.add(u))
            if (item.displayPrimaryPhoto) activeUrls.add(item.displayPrimaryPhoto)
          })
        } catch (e) {
          console.warn('Failed to parse for active images:', filePath, e)
        }
      }

      collectUrls(path.join(outDir, 'data.json'))
      collectUrls(path.join(outDir, 'feed.json'))

      const activeFiles = new Set()
      activeUrls.forEach((url) => {
        if (url && typeof url === 'string' && url.startsWith('/')) {
          activeFiles.add(path.normalize(url.substring(1)))
        }
      })

      const imagesTarget = path.join(outDir, 'images')
      if (fs.existsSync(imagesTarget)) {
        let kept = 0
        let removed = 0
        const walk = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true })
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            const relPath = path.relative(outDir, fullPath)
            if (entry.isDirectory()) {
              walk(fullPath)
              if (fs.readdirSync(fullPath).length === 0) {
                fs.rmdirSync(fullPath)
              }
            } else {
              if (!activeFiles.has(relPath) && !relPath.includes('mockups')) {
                fs.rmSync(fullPath)
                removed++
              } else {
                kept++
              }
            }
          }
        }
        walk(imagesTarget)
        console.log(`[prune-heavy-public] kept ${kept} active images, pruned ${removed} unused files`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pruneHeavyPublicDirs()],
  build: {
    rollupOptions: {
      output: {
        // The single main chunk had grown past 1MB (gzip 318KB) and delayed
        // first paint ~4s on every page. Vendor frameworks load as parallel
        // cacheable chunks instead.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('leaflet')) return 'vendor-leaflet';
          if (id.includes('react')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
})
