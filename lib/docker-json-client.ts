/*
 * Copyright 2012 Mark Cavage, Inc.  All rights reserved.
 * Copyright (c) 2015, Joyent, Inc.
 */

import { Md5 } from "https://deno.land/std@0.92.0/hash/md5.ts";

// --- API

interface HttpReqOpts {
    path: string;
    headers?: Headers;
    retry?: boolean;
    connectTimeout?: number;
    expectStatus?: number[];
    redirect?: RequestRedirect;
}

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
        this.accept = options.accept ?? 'application/json';
        this.name = options.name ?? 'DockerJsonClient';
        this.contentType = options.contentType ?? 'application/json';
        this.url = options.url;
        // this.rejectUnauthorized = options.rejectUnauthorized;
        this.userAgent = options.userAgent;
    }

    async request(opts: HttpReqOpts & { method: string; }) {
        const headers = new Headers(opts.headers);
        if (!headers.has('accept') && this.accept) {
            headers.set('accept', this.accept);
        }
        headers.set('user-agent', this.userAgent);

        const rawResp = await fetch(new URL(opts.path, this.url), {
            method: opts.method,
            headers: headers,
            redirect: opts.redirect ?? 'manual',
        });
        const resp = new DockerResponse(rawResp.body, rawResp);

        const expectStatus = opts.expectStatus ?? [200];
        if (!expectStatus.includes(rawResp.status)) {
            throw await resp
                .dockerError(`Received unexpected HTTP ${rawResp.status} from ${opts.path}`)
                .catch(err => new Error(`Received unexpected HTTP ${rawResp.status} from ${opts.path} - and failed to parse error body: ${err.message}`));
        }
        return resp;
    }

    async get(opts: HttpReqOpts) {
        return await this.request({
            method: 'GET',
            ...opts,
        });
    }

};


export class DockerResponse extends Response {
    // Cache the body once we decode it once.
    decodedBody?: Uint8Array;

    async dockerBody() {
        if (this.decodedBody) return this.decodedBody;

        const bytes = new Uint8Array(await this.arrayBuffer());
        let body = bytes;

        // Content-MD5 check.
        const contentMd5 = this.headers.get('content-md5');
        if (contentMd5 && this.status !== 206) {
            const digest = new Md5().update(bytes).toString('base64');
            if (contentMd5 !== digest) throw new Error(
                `BadDigestError: Content-MD5 (${contentMd5} vs ${digest})`);
        }

        this.decodedBody = body;
        return body;
    }

    async dockerJson() {
        const body = this.decodedBody ?? await this.dockerBody();
        const text = new TextDecoder().decode(body);
        if (text.trim().length == 0) return undefined;

        // Parse the body as JSON, if we can.
        try {
            return JSON.parse(text);
        } catch (jsonErr) {
            // res.log.trace(jsonErr, 'Invalid JSON in response');
            throw new Error(
                'Invalid JSON in response: '+jsonErr.message);
        }
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

        if (!message) {
            if (this.headers.get('content-type')?.startsWith('text/html')) {
                message = '(HTML body)';
            } else {
                message = new TextDecoder().decode(await this.dockerBody()).slice(0, 1024);
            }
        }

        const err = new Error(`${baseMsg}: ${message}`);
        (err as any).resp = this;
        (err as any).restCode = restCode;
        (err as any).restText = restText;
        return err;
    }

    dockerStream() {
        if (!this.body) throw new Error(`No body to stream`);
        let stream = this.body;

        // Content-MD5 check.
        const contentMd5 = this.headers.get('content-md5');
        if (contentMd5 && this.status !== 206) {
            const hash = new Md5();
            stream = stream.pipeThrough(new TransformStream({
                transform(chunk, controller) {
                    hash.update(chunk);
                    controller.enqueue(chunk);
                },
                flush(controller) {
                    const digest = hash.toString('base64');
                    if (contentMd5 !== digest) controller.error(new Error(
                        `BadDigestError: Content-MD5 (${contentMd5} vs ${digest})`));
                },
            }));
        }

        return stream;
    }
}
