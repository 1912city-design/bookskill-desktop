import { inflateRawSync } from "node:zlib";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

/**
 * Minimal ZIP reader for EPUB packages. Supports stored and deflate entries.
 * This is not a general-purpose unzip utility.
 */
export function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  let eocd = -1;
  const min = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("Invalid ZIP/EPUB: end of central directory not found");
  }

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();

  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIG) {
      throw new Error("Invalid ZIP/EPUB: broken central directory");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOff = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");
    offset += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) {
      continue;
    }
    if (buffer.readUInt32LE(localOff) !== LOCAL_SIG) {
      throw new Error(`Invalid ZIP/EPUB local header for ${name}`);
    }
    const localNameLen = buffer.readUInt16LE(localOff + 26);
    const localExtraLen = buffer.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + localNameLen + localExtraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compSize);
    const data =
      method === 0
        ? Buffer.from(compressed)
        : method === 8
          ? inflateRawSync(compressed)
          : null;
    if (!data) {
      throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
    }
    files.set(name, data);
  }
  return files;
}
