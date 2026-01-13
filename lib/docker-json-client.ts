/*
 * Copyright 2012 Mark Cavage, Inc.  All rights reserved.
 * Copyright (c) 2015, Joyent, Inc.
 */

import { HttpError } from "./errors.ts";
import type { ByteArray, DockerResponse as DockerResponseInterface } from "./types.ts";

// --- API

interface HttpReqOpts {
    method: string;
    path: string;
    searchParams?: URLSearchParams;
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

    async request(opts: HttpReqOpts): Promise<DockerResponse> {
        const headers = new Headers(opts.headers);
        if (!headers.has('accept') && this.accept) {
            headers.set('accept', this.accept);
        }
        headers.set('user-agent', this.userAgent);

        const url = new URL(opts.path, this.url);
        for (const param of opts.searchParams ?? []) {
            url.searchParams.append(param[0], param[1]);
        }

        const rawResp = await fetch(url, {
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
    decodedBody?: ByteArray;

    async dockerBody(): Promise<ByteArray> {
        this.decodedBody ??= new Uint8Array(await this.arrayBuffer());
        return this.decodedBody;
    }

    async dockerJson<Tjson=Record<string,unknown>>(): Promise<Tjson> {
        const body = this.decodedBody ?? await this.dockerBody();
        const text = new TextDecoder().decode(body);

        // Parse the body as JSON, if we can.
        try {
            return JSON.parse(text);
        } catch (thrown) {
            const err = thrown as Error;
            // res.log.trace(jsonErr, 'Invalid JSON in response');
            throw new Error(
                'Invalid JSON in response: '+err.message);
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
        const errObj = (obj?.error ? [obj.error] : (obj?.errors as unknown[]) ?? (obj ? [obj] : [])) as Array<{
            code?: string;
            message: string;
            detail?: string;
        }>;
        return errObj.flatMap(x => typeof x?.message === 'string' ? [x] : []);
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
        } catch (thrown) {
            const err = thrown as Error;
            return new HttpError(this, [], `${baseMsg} - and failed to parse error body: ${err.message}`);
        }
    }

    dockerStream(): ReadableStream<ByteArray> {
        if (!this.body) throw new Error(`No body to stream`);
        return this.body;
    }
}
