/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

import { RegistryImage } from "./types.ts";
import * as reg2 from './registry-client-v2.ts';

export * from './types.ts';
export { RegistryClientV2 } from './registry-client-v2.ts';

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
    acceptOCIManifests?: boolean;
    maxSchemaVersion?: number;
    userAgent?: string;
}) {
    // Version given.
    if (opts.version === 2) {
        return reg2.createClient(opts);
    } else if (opts.version) {
        throw new Error('unsupported API version: ' + opts.version);
    }

    // First try v2.
    var client = reg2.createClient(opts);
    if (await client.supportsV2()) {
        return client;
    } else {
        throw new Error('unsupported API version: ' + 'v1');
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
