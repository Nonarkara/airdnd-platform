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
            for (const field of ['photoUrls', 'photo_urls', 'allPhotoUrls', 'drivePhotoUrls']) {
              if (Array.isArray(item[field])) item[field].forEach((u) => activeUrls.add(u))
            }
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
        // Count first, delete second.
        //
        // This step exists only because Cloudflare Pages caps a deployment at
        // 20,000 files. It is not a cleanup for its own sake, and it must never
        // be trusted to decide what is "unused" when the manifest it reads is
        // broken. It deleted 2,924 of 2,940 photographs once already, because
        // data.json had silently lost its photo arrays and the plugin
        // faithfully concluded that nothing was in use.
        //
        // Two guards, in order:
        //   1. Under budget, prune nothing. There is no reason to.
        //   2. Over budget but the manifest references almost nothing —
        //      refuse, and say why. A snapshot bug must not become data loss.
        const FILE_BUDGET = 18000
        const countFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true })
          .reduce((n, e) => n + (e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1), 0)
        const totalImages = countFiles(imagesTarget)

        if (totalImages <= FILE_BUDGET) {
          console.log(`[prune-heavy-public] ${totalImages} images is within the ${FILE_BUDGET}-file budget — pruning nothing`)
          return
        }

        const referencedShare = totalImages > 0 ? activeFiles.size / totalImages : 0
        if (referencedShare < 0.1) {
          console.warn(
            `[prune-heavy-public] REFUSING to prune: data.json references only ${activeFiles.size} of ${totalImages} images ` +
            `(${(referencedShare * 100).toFixed(1)}%). That almost certainly means the snapshot lost its photo arrays, ` +
            'not that the archive is dead. Run `node scripts/repair_photo_links.js`, then rebuild.'
          )
          return
        }

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
})
