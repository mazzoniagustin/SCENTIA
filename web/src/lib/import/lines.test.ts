import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { readLines } from './lines.ts'

describe('readLines', () => {
  it('corta solo en salto de línea: U+2028/U+2029 dentro de un registro no lo parten', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lines-')), 'a.jsonl')
    const a = JSON.stringify({ id: 1, text: 'uno dos tres' })
    const b = JSON.stringify({ id: 2, text: 'x' })
    fs.writeFileSync(file, `${a}\r\n\n${b}`) // CRLF, línea vacía y último registro sin salto final
    const out: string[] = []
    for await (const line of readLines(file)) out.push(line)
    assert.equal(out.length, 2)
    assert.equal(JSON.parse(out[0]).text, 'uno dos tres')
    assert.equal(JSON.parse(out[1]).id, 2)
    fs.rmSync(path.dirname(file), { recursive: true })
  })
})
