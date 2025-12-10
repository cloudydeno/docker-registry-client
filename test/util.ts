import { assert } from "@std/assert/assert";
import { assertEquals } from "@std/assert/equals";
import { assertObjectMatch } from "@std/assert/object-match";
import { assertRejects } from "@std/assert/rejects";
import { assertThrows } from "@std/assert/throws";
export {
  assert,
  assertEquals,
  assertObjectMatch,
  assertRejects,
  assertThrows,
};

export { dirname } from "@std/path/dirname";

import { HttpError } from "@cloudydeno/docker-registry-client/errors";
import { MEDIATYPE_MANIFEST_V2, MEDIATYPE_OCI_MANIFEST_V1 } from "@cloudydeno/docker-registry-client/common";
import { Manifest } from "@cloudydeno/docker-registry-client/types";

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
