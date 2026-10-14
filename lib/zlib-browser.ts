import { inflate, inflateRaw } from "pako";

function asBuffer(data: Uint8Array): Buffer {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

export function inflateSync(data: Uint8Array): Buffer {
  return asBuffer(inflate(data));
}

export function inflateRawSync(data: Uint8Array): Buffer {
  return asBuffer(inflateRaw(data));
}
