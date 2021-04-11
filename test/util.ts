import { assertEquals, assertThrowsAsync } from "https://deno.land/std@0.92.0/testing/asserts.ts";
import { HttpError } from "../lib/errors.ts";

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
