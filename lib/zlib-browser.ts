import { inflate, inflateRaw } from "pako";

export function inflateSync(data: Uint8Array): Uint8Array {
  return inflate(data);
}

export function inflateRawSync(data: Uint8Array): Uint8Array {
  return inflateRaw(data);
}
