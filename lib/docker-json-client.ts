/*
 * Copyright 2012 Mark Cavage, Inc.  All rights reserved.
 * Copyright (c) 2015, Joyent, Inc.
 */

/*
 * Adapted from
 * <github.com/mcavage/node-restify/blob/master/lib/clients/string_client.js>
 * now at <https://github.com/restify/clients/blob/master/lib/StringClient.js>
 *
 * This subclasses the Restify StringClient to add the following features:
 *
 * 1. Extend the callback from
 *      callback(err, req, res, <JSON-parsed-body>);
 *    to:
 *      callback(err, req, res, <JSON-parsed-body>, <raw-body (Buffer)>);
 *    This allows one to work on the raw body for special case handling, if
 *    wanted. I wouldn't propose this for restify core because it shouldn't
 *    add features that make it harder to go all streaming.
 *
 * 2. In restify.JsonClient, if the body is not parseable JSON, it log.trace's
 *    an error, and returns `{}` (see mcavage/restify#388). I don't particularly
 *    like that because it is ambiguous (and also disallows returning a JSON
 *    body that is false-y: `false`, `0`, `null`).
 *
 *    Instead this client will do the following:
 *    (a) If the response is an error status (>=400), then return `undefined`
 *        for the body. This allows the caller to know if the body was parsed
 *        because `undefined` is not representable in JSON.
 *    (b) If the response is a success (<400), then return an InvalidContent
 *        restify error.
 *
 *    (TODO: I'd support this for restify code, but it *is* backward
 *    incompatible.)
 *
 * 3. `.write()` doesn't default a null `body` to `{}`.
 *    This change isn't because I came across the need for it, but because that
 *    just seems wrong.
 *
 * 4. Doesn't set `res.body` which restify's StringClient.parse seems to do
 *    ... as an accident of history I'm guessing?
 */

// var assert = require('assert-plus');
// var crypto = require('crypto');
// var restifyClients = require('restify-clients');
// var restifyErrors = require('restify-errors');
// var strsplit = require('strsplit').strsplit;
// var util = require('util');
// var zlib = require('zlib');

// var StringClient = restifyClients.StringClient;

import { Md5 } from "https://deno.land/std@0.92.0/hash/md5.ts";
import { gunzip } from "https://deno.land/x/compress@v0.3.7/gzip/gzip.ts";
import * as Base64 from "https://deno.land/std@0.92.0/encoding/base64.ts";

// --- API

export class DockerJsonClient {
    accept: string;
    name: string;
    contentType: string;
    url: string;
    userAgent: string;

  constructor(options: {
    name?: string;
    accept?: string;
    contentType?: string;
    url: string;
    rejectUnauthorized?: boolean;
    userAgent: string;
  }) {
    this.accept = options.accept || 'application/json';
    this.name = options.name || 'DockerJsonClient';
    this.contentType = options.contentType || 'application/json';
    this.url = options.url;
    // this.rejectUnauthorized = options.rejectUnauthorized;
    this.userAgent = options.userAgent;
  }

  async get(opts: {
    path: string,
    headers?: Headers,
    retry?: boolean,
    connectTimeout?: number,
    expectStatus?: number[],
  }) {
    const headers = new Headers(opts.headers);
    headers.set('accept', this.accept);
    headers.set('user-agent', this.userAgent);

    const rawResp = await fetch(new URL(opts.path, this.url), {
        method: 'GET',
        headers: headers,
    });
    const resp = new DockerResponse(rawResp.body, rawResp);

    const expectStatus = opts.expectStatus ?? [200];
    if (!expectStatus.includes(rawResp.status)) {
        throw await resp.dockerError(`Received unexpected HTTP ${rawResp.status} from ${opts.path}`);
    }
    return resp;
  }

//   write(options, body, callback) {
//     assert.object(body, 'body');

//     // This is change #3.
//     var resBody = JSON.stringify(body);
//     return (this._super.write.call(this, options, resBody, callback));
//   };

};


export class DockerResponse extends Response {

    decodedBody?: Uint8Array;

    async dockerBody() {
        if (this.decodedBody) return this.decodedBody;

        const bytes = new Uint8Array(await this.arrayBuffer());
        let body = bytes;

        // Content-MD5 check.
        const contentMd5 = this.headers.get('content-md5');
        if (contentMd5 && this.status !== 206) {
            const hash = new Md5();
            hash.update(bytes);
            const digest = Base64.encode(hash.digest());
            if (contentMd5 !== digest) throw new Error(
                `BadDigestError: Content-MD5 (${contentMd5} vs ${digest})`);
        }

        // Decompression
        if (this.headers.get('content-encoding') === 'gzip') {
            body = gunzip(body);
        }

        // Content-Length check
        const contentLength = Number(this.headers.get('content-length') ?? undefined);
        if (!isNaN(contentLength) && body.length !== contentLength) {
            throw new Error(
                `Incomplete content: Content-Length:${contentLength} but got ${body.length} or ${bytes.length} bytes`);
        }

        this.decodedBody = body;
        return body;
    }

    async dockerJson() {
        const body = this.decodedBody ?? await this.dockerBody();

        // Parse the body as JSON, if we can.
        // Note: This regex-based trim works on a buffer. `trim()` doesn't.
        const text = new TextDecoder().decode(body);
        if (text.length > 0 && !/^\s*$/.test(text)) {  // Skip all-whitespace body.
            try {
                return JSON.parse(text);
            } catch (jsonErr) {
                // res.log.trace(jsonErr, 'Invalid JSON in response');
                // if (!resErr) {
                    // TODO: Does this mask other error statuses?
                    throw new Error(
                        'Invalid JSON in response: '+jsonErr.message);
                // }
            }
        }

        return undefined;
    }

    async dockerError(baseMsg: string) {
        let message = '';
        let restText = '';
        let restCode = '';

        if (this.status >= 400) {
            // Upcast error to a RestError (if we can)
            // Be nice and handle errors like
            // { error: { code: '', message: '' } }
            // in addition to { code: '', message: '' }.
            const obj = await this.dockerJson().catch(() => null);
            let errObj = obj?.error ?? obj?.errors?.[0] ?? obj;
            if (errObj?.code || errObj?.message) {
                restCode = errObj.code || '';
                restText = errObj.message || '';
                if (restCode && restText) {
                    message = `(${restCode}) ${restText}`;
                }
            }
        }

        console.log(new TextDecoder().decode(await this.dockerBody()).slice(0, 4096));
        const err = new Error(`${baseMsg}: ${message || new TextDecoder().decode(await this.dockerBody()).slice(0, 4096)}`);
        (err as any).resp = this;
        (err as any).restCode = restCode;
        (err as any).restText = restText;
        return err;
    }
}
