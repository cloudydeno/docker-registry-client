/*
 * Copyright 2012 Mark Cavage, Inc.  All rights reserved.
 * Copyright (c) 2015, Joyent, Inc.
 */

import { Md5 } from "https://deno.land/std@0.130.0/hash/md5.ts";
import { HttpError } from "./errors.ts";
import { DockerResponse as DockerResponseInterface } from "./types.ts";

// --- API

interface HttpReqOpts {
    method: string;
    path: string;
    headers?: Headers;
    body?: BodyInit;
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
    client?: Deno.HttpClient;

    constructor(options: {
        name?: string;
        accept?: string;
        contentType?: string;
        url: string;
        // rejectUnauthorized?: boolean;
        userAgent: string;
        client?: Deno.HttpClient;
    }) {
        this.accept = options.accept ?? 'application/json';
        this.name = options.name ?? 'DockerJsonClient';
        this.contentType = options.contentType ?? 'application/json';
        this.url = options.url;
        this.userAgent = options.userAgent;
        this.client = options.client;
    }

    async request(opts: HttpReqOpts) {
        const headers = new Headers(opts.headers);
        if (!headers.has('accept') && this.accept) {
            headers.set('accept', this.accept);
        }
        headers.set('user-agent', this.userAgent);

        const rawResp = await fetch(new URL(opts.path, this.url), {
            client: this.client,
            method: opts.method,
            headers: headers,
            redirect: opts.redirect ?? 'manual',
            body: opts.body,
        });
        const resp = new DockerResponse(rawResp.body, {
            headers: rawResp.headers,
            status: rawResp.status,
            statusText: rawResp.statusText,
        });

        const expectStatus = opts.expectStatus ?? [200];
        if (!expectStatus.includes(rawResp.status)) {
            throw await resp
                .dockerThrowable(`Unexpected HTTP ${rawResp.status} from ${opts.path}`);
        }
        return resp;
    }
};


export class DockerResponse extends Response implements DockerResponseInterface {
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

    async dockerErrors(): Promise<Array<{
        code?: string;
        message: string;
        detail?: string;
    }>> {
        const obj = await this.dockerJson().catch(() => null);

        // Upcast error to a RestError (if we can)
        // Be nice and handle errors like
        // { error: { code: '', message: '' } }
        // in addition to { code: '', message: '' }.
        let errObj = obj?.error ? [obj.error] : (obj?.errors as any[]) ?? (obj ? [obj] : []);
        return errObj.filter(x => typeof x.message === 'string');
    }

    async dockerThrowable(baseMsg: string): Promise<HttpError> {
        // no point trying to parse HTML
        if (this.headers.get('content-type')?.startsWith('text/html')) {
            await this.arrayBuffer();
            return new HttpError(this, [], `${baseMsg} (w/ HTML body)`);
        }

        try {
            const errors = this.status >= 400 ? await this.dockerErrors() : [];
            if (errors.length === 0) {
                const text = new TextDecoder().decode(await this.dockerBody());
                if (text.length > 1) {
                    errors.push({ message: text.slice(0, 512) });
                }
            }
            const errorTexts = errors.map(x => '    '+[x.code, x.message, x.detail ? JSON.stringify(x.detail) : ''].filter(x => x).join(': '));

            return new HttpError(this, errors, [baseMsg, ...errorTexts].join('\n'));
        } catch (err) {
            return new HttpError(this, [], `${baseMsg} - and failed to parse error body: ${err.message}`);
        }
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
