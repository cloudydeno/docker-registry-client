export { assertEquals, assert } from "https://deno.land/std@0.130.0/testing/asserts.ts";
export { dirname } from "https://deno.land/std@0.130.0/path/posix.ts";


import { Sha256 } from "https://deno.land/std@0.130.0/hash/sha256.ts";
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.130.0/testing/asserts.ts";

import { HttpError } from "../lib/errors.ts";
import { MEDIATYPE_MANIFEST_V2, MEDIATYPE_OCI_MANIFEST_V1 } from "../lib/common.ts";
import { Manifest } from "../lib/types.ts";

export async function assertThrowsHttp<T = void>(
  fn: () => Promise<T>,
  statusCode?: number,
  msgIncludes = "",
  msg?: string,
): Promise<HttpError> {
  let httpErr: HttpError | undefined;
  await assertRejects(async () => {
    try {
      await fn()
    } catch (err) {
      if (err instanceof HttpError) {
        httpErr = err;
      }
      throw err;
    }
  }, HttpError, msgIncludes, msg);

  assert(httpErr);
  if (statusCode) {
    assertEquals(httpErr.resp.status, statusCode);
  }
  return httpErr;
}

export function getFirstLayerDigestFromManifest(manifest: Manifest) {
  if (manifest.mediaType !== MEDIATYPE_MANIFEST_V2 &&
      manifest.mediaType !== MEDIATYPE_OCI_MANIFEST_V1) {
    throw new Error(`unexpected non-image manifest`);
  }
  return manifest.layers![0].digest;
}

function bytesToHex(data: ArrayBuffer) {
  return [...new Uint8Array(data)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}
export async function hashAndCount(
  digestType: string,
  stream: ReadableStream<Uint8Array>,
) {
  assertEquals(digestType, 'sha256');
  const body = await new Response(stream).arrayBuffer();
  return {
    hashHex: bytesToHex(await crypto.subtle.digest("SHA-256", body)),
    numBytes: body.byteLength,
  };
}
