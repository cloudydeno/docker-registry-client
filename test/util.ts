export { assertEquals, assert } from "https://deno.land/std@0.105.0/testing/asserts.ts";
export { dirname } from "https://deno.land/std@0.105.0/path/posix.ts";


import { Sha256 } from "https://deno.land/std@0.105.0/hash/sha256.ts";
import { assertEquals, assertThrowsAsync } from "https://deno.land/std@0.105.0/testing/asserts.ts";

import { HttpError } from "../lib/errors.ts";
import { MEDIATYPE_MANIFEST_LIST_V2 } from "../lib/registry-client-v2.ts";
import { Manifest } from "../lib/types.ts";

export async function assertThrowsHttp<T = void>(
  fn: () => Promise<T>,
  statusCode?: number,
  msgIncludes = "",
  msg?: string,
): Promise<HttpError> {
  const err = await assertThrowsAsync(fn, HttpError, msgIncludes, msg) as HttpError;
  if (statusCode) assertEquals(err.resp.status, statusCode);
  return err;
}

export function getFirstLayerDigestFromManifest(manifest: Manifest) {
  if (manifest.schemaVersion === 1) {
      return manifest.fsLayers![0].blobSum;
  }
  if (manifest.mediaType === MEDIATYPE_MANIFEST_LIST_V2) throw new Error(
      `unexpected list manifest`);
  return manifest.layers![0].digest;
}

export async function hashAndCount(
  digestType: string,
  stream: ReadableStream<Uint8Array>,
) {
  assertEquals(digestType, 'sha256');

  let numBytes = 0;
  const hash = new Sha256();

  for await (const chunk of stream) {
    hash.update(chunk);
    numBytes += chunk.length;
  }
  
  return {
    hashHex: hash.hex(),
    numBytes,
  };
}
