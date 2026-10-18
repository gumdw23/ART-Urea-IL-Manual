import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const source = path.join(root, "manual-site")
const target = path.join(root, "public", "urea-manual")

if (!fs.existsSync(source)) {
  throw new Error(`Manual source not found: ${source}`)
}

fs.rmSync(target, { recursive: true, force: true })
fs.mkdirSync(target, { recursive: true })
fs.cpSync(source, target, { recursive: true })

const redirect = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ART · UREA IL Visual Library</title>
<meta http-equiv="refresh" content="0; url=./urea-manual/"></head>
<body><p>Opening <a href="./urea-manual/">UREA IL Manual</a>…</p>
<script>location.replace('./urea-manual/')</script></body></html>`
fs.writeFileSync(path.join(root, "public", "index.html"), redirect, "utf8")
console.log("UREA Manual copied to public/urea-manual and root redirect installed.")
