/**
 * Streaming `.tgz` (gzip + USTAR/PAX tar) single-file extractor.
 *
 * Used for the China-reachable npmmirror tarball fallback: npm packages bundle
 * multiple files (e.g. both compact v4 and legacy v3 catalogs), so streaming
 * through gunzip lets us stop and cancel the HTTP download the moment the
 * target file finishes — skipping the remaining ~60% of the archive.
 */
import { createGunzip } from 'node:zlib'

const TAR_BLOCK = 512

function readAscii(block: Uint8Array, start: number, end: number): string {
  let limit = end
  for (let i = start; i < end; i += 1) {
    if (block[i] === 0) {
      limit = i
      break
    }
  }
  return Buffer.from(block.subarray(start, limit)).toString('utf8')
}

function parseOctal(block: Uint8Array, start: number, end: number): number {
  const raw = readAscii(block, start, end).trim()
  if (raw === '') return 0
  const parsed = Number.parseInt(raw, 8)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('invalid tar entry size')
  return parsed
}

function normalizeTarPath(raw: string): string {
  return raw.replace(/^\.\//, '').replace(/^\/+/, '')
}

function parsePaxPath(data: Buffer): string | undefined {
  let pos = 0
  while (pos < data.length) {
    const space = data.indexOf(0x20 /* ' ' */, pos)
    if (space < 0) break
    const len = Number.parseInt(data.subarray(pos, space).toString('ascii'), 10)
    const headerLen = space - pos + 1
    if (!Number.isFinite(len) || len <= headerLen || pos + len > data.length) break
    let end = pos + len
    if (data[end - 1] === 0x0a /* '\n' */) end -= 1
    const record = data.subarray(space + 1, end).toString('utf8')
    if (record.startsWith('path=')) return record.slice(5)
    pos += len
  }
  return undefined
}

/**
 * Extract the first matching file from a gzipped tar response stream,
 * cancelling the underlying HTTP stream as soon as the entry is complete.
 * @param response - HTTP 200 response whose body is a `.tgz` stream.
 * @param targetPaths - Normalized paths to accept (checked in order of arrival).
 * @param maxBytes - Upper bound for both compressed download and decompressed output.
 * @returns The extracted file bytes.
 */
export async function extractFileFromTgzResponse(
  response: Response,
  targetPaths: readonly string[],
  maxBytes: number,
): Promise<Buffer> {
  const tooLarge = `catalog exceeds the ${String(Math.round(maxBytes / (1024 * 1024)))} MiB size limit`
  if (Number(response.headers.get('content-length')) > maxBytes) {
    void response.body?.cancel().catch(() => undefined)
    throw new Error(tooLarge)
  }
  if (response.body === null) throw new Error('catalog tarball response is empty')

  const wanted = new Set(targetPaths.map(normalizeTarPath))
  const reader = response.body.getReader()
  const gunzip = createGunzip()

  let compressedBytes = 0
  let decompressedBytes = 0
  let pending: Buffer = Buffer.alloc(0)
  let phase: 'header' | 'body' | 'padding' = 'header'
  let remainingBody = 0
  let remainingPad = 0
  let captureKind: 'none' | 'target' | 'longname' | 'pax' = 'none'
  let capturedChunks: Buffer[] = []
  let nextLongName: string | undefined
  let nextPaxPath: string | undefined
  let found: Buffer | undefined
  let doneParsing = false
  let streamError: unknown

  const resetCapture = (): void => {
    captureKind = 'none'
    capturedChunks = []
  }

  const processDecompressed = (chunk: Buffer): void => {
    if (doneParsing) return
    decompressedBytes += chunk.byteLength
    if (decompressedBytes > maxBytes) {
      throw new Error(tooLarge)
    }
    pending = pending.length === 0 ? chunk : Buffer.concat([pending, chunk])

    while (!doneParsing) {
      if (phase === 'header') {
        if (pending.length < TAR_BLOCK) break
        const header = pending.subarray(0, TAR_BLOCK)
        pending = pending.subarray(TAR_BLOCK)
        if (header.every(byte => byte === 0)) {
          doneParsing = true
          break
        }
        const name = readAscii(header, 0, 100)
        const prefix = readAscii(header, 345, 500)
        const headerPath = prefix !== '' ? `${prefix}/${name}` : name
        const size = parseOctal(header, 124, 136)
        if (size > maxBytes) throw new Error(tooLarge)
        const typeFlag = header[156]
        const resolvedPath = normalizeTarPath(nextPaxPath ?? nextLongName ?? headerPath)
        nextPaxPath = undefined
        nextLongName = undefined

        const isRegularFile = typeFlag === 0 || typeFlag === 0x30 /* '0' */
        const isLongName = typeFlag === 0x4c /* 'L' */
        const isPax = typeFlag === 0x78 /* 'x' */
        resetCapture()
        if (isRegularFile && wanted.has(resolvedPath)) captureKind = 'target'
        else if (isLongName) captureKind = 'longname'
        else if (isPax) captureKind = 'pax'

        remainingBody = size
        remainingPad = (TAR_BLOCK - (size % TAR_BLOCK)) % TAR_BLOCK
        if (remainingBody > 0) {
          phase = 'body'
        } else {
          if (captureKind === 'target') {
            found = Buffer.alloc(0)
            doneParsing = true
            break
          }
          phase = remainingPad > 0 ? 'padding' : 'header'
        }
      } else if (phase === 'body') {
        if (pending.length === 0) break
        const take = Math.min(pending.length, remainingBody)
        if (captureKind !== 'none') {
          capturedChunks.push(Buffer.from(pending.subarray(0, take)))
        }
        pending = pending.subarray(take)
        remainingBody -= take
        if (remainingBody === 0) {
          if (captureKind === 'target') {
            found = capturedChunks.length === 1 ? capturedChunks[0]! : Buffer.concat(capturedChunks)
            doneParsing = true
            break
          }
          if (captureKind === 'longname') {
            const raw = Buffer.concat(capturedChunks).toString('utf8').replace(/\0.*$/, '')
            nextLongName = raw
          } else if (captureKind === 'pax') {
            nextPaxPath = parsePaxPath(Buffer.concat(capturedChunks))
          }
          resetCapture()
          phase = remainingPad > 0 ? 'padding' : 'header'
        }
      } else {
        if (pending.length === 0) break
        const skip = Math.min(pending.length, remainingPad)
        pending = pending.subarray(skip)
        remainingPad -= skip
        if (remainingPad === 0) phase = 'header'
      }
    }
  }

  let finished = false
  let resolveDone!: () => void
  let rejectDone!: (error: unknown) => void
  const gunzipDone = new Promise<void>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })
  gunzipDone.catch(() => undefined)

  gunzip.on('data', (chunk: Buffer) => {
    if (finished) return
    try {
      processDecompressed(chunk)
      if (doneParsing && !finished) {
        finished = true
        resolveDone()
        gunzip.destroy()
      }
    } catch (error) {
      if (!finished) {
        finished = true
        streamError = error
        rejectDone(error)
        gunzip.destroy()
      }
    }
  })
  gunzip.on('error', (error) => {
    if (!finished) {
      finished = true
      streamError = error
      rejectDone(error)
    }
  })
  gunzip.on('end', () => {
    if (!finished) {
      finished = true
      resolveDone()
    }
  })

  try {
    for (;;) {
      if (doneParsing || streamError !== undefined) break
      const { done, value } = await reader.read()
      if (done) break
      compressedBytes += value.byteLength
      if (compressedBytes > maxBytes) throw new Error(tooLarge)
      await new Promise<void>((resolve, reject) => {
        if (doneParsing || streamError !== undefined) {
          resolve()
          return
        }
        const onErr = (err: unknown): void => {
          cleanup()
          if (doneParsing || streamError !== undefined) resolve()
          else reject(err)
        }
        const onClose = (): void => { cleanup(); resolve() }
        const cleanup = (): void => {
          gunzip.off('error', onErr)
          gunzip.off('close', onClose)
        }
        gunzip.once('error', onErr)
        gunzip.once('close', onClose)
        gunzip.write(value, (err) => {
          cleanup()
          if (err && !doneParsing && streamError === undefined) reject(err)
          else resolve()
        })
      })
      if (doneParsing || streamError !== undefined) break
    }
    if (!doneParsing && streamError === undefined) {
      gunzip.end()
      await gunzipDone
    }
    if (streamError !== undefined) throw streamError
  } finally {
    gunzip.destroy()
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }

  if (found === undefined) {
    throw new Error(`catalog tarball did not contain ${targetPaths.join(' or ')}`)
  }
  return found
}
