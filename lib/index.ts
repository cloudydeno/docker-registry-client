/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

import { RegistryImage, RegistryIndex } from "./types.ts";
// import * as reg1 from './registry-client-v1.ts';
import * as reg2 from './registry-client-v2.ts';


// --- exported functions

/**
 * Create a Docker Registry API client.
 *
 * If `opts.version` is given, it will return a client using that API version.
 * Otherwise it will attempt to determine the most suitable version by
 * pinging the server.
 *
 * @param {String} opts.name  The docker *repository* string. E.g. "busybox",
 *      "joshwilsdon/nodejs", "alpine:latest", "quay.io/quay/elasticsearch".
 * @param {Number} opts.version  Optional API version number: 1 or 2.
 * @param ... All other v1 or v2 `createClient` options.
 */
export async function createClient(opts: {
    name?: string;
    repo?: RegistryImage;
    version?: number;
    // log
    username?: string;
    password?: string;
    token?: string; // for bearer auth
    insecure?: boolean;
    scheme?: string;
    acceptManifestLists?: boolean;
    maxSchemaVersion?: number;
    userAgent?: string;
}) {
    // Version given.
    if (opts.version === 1) {
        throw new Error('invalid API version: ' + opts.version);
        // return reg1.createClient(opts);
    } else if (opts.version === 2) {
        return reg2.createClient(opts);
    } else if (opts.version) {
        throw new Error('invalid API version: ' + opts.version);
    }

    // First try v2.
    var client = reg2.createClient(opts);
    if (await client.supportsV2()) {
        return client;
    } else {
        // Otherwise, fallback to v1.
        throw new Error('invalid API version: ' + 'v1');
        // return reg1.createClient(opts);
    }
}


/*
 * Login to a Docker registry. Basically this just means testing given
 * creds (username/password) against the registry.
 *
 * This is wrapper around v1/v2 login. Generally speaking an attempt is
 * made to ping the given index to see if it supports v2. If so, then the
 * v2 Registry API login logic is used. Otherwise the v1 logic. However, as of
 * Docker 1.11 (Docker Remote API 1.23) the "email" field has been dropped
 * for login -- `docker login` no longer prompts for the email field. As a
 * result, `opts.email` is optional to this method. v1 logic is not attempted
 * if `opts.email` is not provided.
 *
 * See: docker.git:registry/auth.go#Login
 *
 * @param opts.index {String|Object} Required. One of an index *name*
 *      (e.g. "docker.io", "quay.io") that `parseIndex` will handle, an index
 *      *url* (e.g. the default from `docker login` is
 *      'https://index.docker.io/v1/'), or an index *object* as returned by
 *      `parseIndex`. For backward compatibility, `opts.indexName` may be
 *      used instead of `opts.index`.
 * @param opts.username {String} Required.
 * @param opts.password {String} Required.
 * @param opts.email {String} Optional. See discussion above.
 * ... Other optional opts fields. See the implementations. ...
 * @param cb {Function} `function (err, result)`
 *      On success, `result` is an object with:
 *          status      a string description of the login result status
 */
export async function login(opts: {
    index: string | RegistryIndex;
    username: string;
    password: string;
    email?: string;
}) {
    const pingRes = await reg2.ping(opts);
    if (!pingRes) {
        throw new Error('no err *or* res from v2 ping');
    }
    if (pingRes.status === 404) {
        // The index doesn't support v2, so try v1 if we can.
        if (opts.email) {
            // return await reg1.login(opts);
        }
    } else {
        return await reg2.login({
            // Pass this in so v2 login doesn't need to retry it for the
            // WWW-Authenticate header.
            pingRes: pingRes,
            ...opts,
        });
    }
}


// --- exports

//     createClientV2: reg2.createClient,
//     pingV2: reg2.ping,
//     loginV2: reg2.login,
//     digestFromManifestStr: reg2.digestFromManifestStr,
//     MEDIATYPE_MANIFEST_V2: reg2.MEDIATYPE_MANIFEST_LIST_V2,
//     MEDIATYPE_MANIFEST_LIST_V2: reg2.MEDIATYPE_MANIFEST_LIST_V2,

//     createClientV1: reg1.createClient,
//     pingIndexV1: reg1.pingIndex,
//     loginV1: reg1.login,

//     DEFAULT_INDEX_NAME: common.DEFAULT_INDEX_NAME,
//     DEFAULT_TAG: common.DEFAULT_TAG,
//     parseRepo: common.parseRepo,
//     parseIndex: common.parseIndex,
//     parseRepoAndRef: common.parseRepoAndRef,
//     // Using `parseRepoAndRef` is preferred over `parseRepoAndTag`.
//     parseRepoAndTag: common.parseRepoAndTag
