import fs from 'fs'

/** Recorre un archivo de texto línea a línea cortando SOLO en "\n".
 *  `readline` también corta en U+2028/U+2029, que pueden aparecer sin escapar dentro de un JSON y parten el registro. */
export async function* readLines(file: string): AsyncGenerator<string> {
  let rest = ''
  for await (const part of fs.createReadStream(file, { encoding: 'utf8' })) {
    rest += part
    let i: number
    while ((i = rest.indexOf('\n')) >= 0) {
      const line = rest.slice(0, i).replace(/\r$/, '')
      rest = rest.slice(i + 1)
      if (line) yield line
    }
  }
  if (rest.trim()) yield rest
}
