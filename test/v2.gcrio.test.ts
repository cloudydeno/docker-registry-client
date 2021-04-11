/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2017, Joyent, Inc.
 */

import { assertEquals, assert } from "https://deno.land/std@0.92.0/testing/asserts.ts";
import { createClient, MEDIATYPE_MANIFEST_LIST_V2 } from "../lib/registry-client-v2.ts";
import { parseRepo } from "../lib/common.ts";
import { ManifestV2 } from "../lib/types.ts";
import { Sha256 } from "https://deno.land/std@0.92.0/hash/sha256.ts";
import { assertThrowsHttp } from "./util.ts";

// --- globals

const REPO = 'gcr.io/google_containers/pause';
const TAG = 'latest';

// --- Tests

const repo = parseRepo(REPO);
const clientOpts = {
    maxSchemaVersion: 2,
    name: REPO,
};

Deno.test('v2 gcr.io / createClient', async () => {
    const client = createClient(clientOpts);
    assertEquals(client.version, 2);
});

Deno.test('v2 gcr.io / supportsV2', async () => {
    const client = createClient(clientOpts);
    const supportsV2 = await client.supportsV2();
    assert(supportsV2, 'supportsV2');
});

Deno.test('v2 gcr.io / ping', async () => {
    const client = createClient(clientOpts);
    const res = await client.ping();
    assertEquals(res.status, 401);
    assert(res.headers.has('www-authenticate'));
    assertEquals(res.headers.get('docker-distribution-api-version'),
        'registry/2.0');
});

/*
    * Example expected output:
    *  {
    *      "name": "library/alpine",
    *      "tags": [ "2.6", "2.7", "3.1", "3.2", "edge", "latest" ]
    *  }
    */
Deno.test('v2 gcr.io / listTags', async () => {
    const client = createClient(clientOpts);
    const tags = await client.listTags();
    assert(tags);
    assertEquals(tags.name, repo.remoteName);
    assert(tags.tags.indexOf(TAG) !== -1, 'no "'+TAG+'" tag');
});

/*
    * {
    *   "schemaVersion": 2,
    *   "mediaType": "application/vnd.docker.distribution.manifest.v2+json",
    *   "config": {
    *     "mediaType": "application/octet-stream",
    *     "size": 1459,
    *     "digest": "sha256:2b8fd9751c4c0f5dd266fc...01"
    *   },
    *   "layers": [
    *     {
    *       "mediaType": "application/vnd.docker.image.rootfs.diff.tar.gzip",
    *       "size": 667590,
    *       "digest": "sha256:8ddc19f16526912237dd8af...a9"
    *     }
    *   ]
    * }
    */
let _manifest: ManifestV2 | null;
let _manifestDigest: string | null;
Deno.test('v2 gcr.io / getManifest', async () => {
    const client = createClient(clientOpts);
    const {manifest, resp} = await client.getManifest({ref: TAG});
    _manifestDigest = resp.headers.get('docker-content-digest');
    assert(manifest);
    assert(_manifestDigest, 'check for manifest digest header');
    assertEquals(manifest.schemaVersion, 2);
    assert(manifest.schemaVersion === 2);
    assert(manifest.mediaType !== MEDIATYPE_MANIFEST_LIST_V2);
    _manifest = manifest ?? null;
    assert(manifest.config);
    assert(manifest.config.digest, manifest.config.digest);
    assert(manifest.layers);
    assert(manifest.layers.length > 0);
    assert(manifest.layers[0].digest);
});

Deno.test('v2 gcr.io / getManifest (by digest)', async () => {
    if (!_manifestDigest || !_manifest) throw new Error('cannot test');
    const client = createClient(clientOpts);
    const {manifest} = await client.getManifest({ref: _manifestDigest});
    assert(manifest);
    assertEquals(_manifest!.schemaVersion, manifest.schemaVersion);
    assert(manifest.schemaVersion === 2);
    assert(manifest.mediaType !== MEDIATYPE_MANIFEST_LIST_V2);
    assertEquals(_manifest!.config, manifest.config);
    assertEquals(_manifest!.layers, manifest.layers);
});

Deno.test('v2 gcr.io / getManifest (unknown tag)', async () => {
    const client = createClient(clientOpts);
    await assertThrowsHttp(async () => {
        await client.getManifest({ref: 'unknowntag'});
    }, 404);
});

Deno.test('v2 gcr.io / getManifest (unknown repo)', async () => {
    const client = createClient({
        maxSchemaVersion: 2,
        name: 'unknownreponame',
    });
    await assertThrowsHttp(async () => {
        await client.getManifest({ref: 'latest'});
    }, 401);
});

Deno.test('v2 gcr.io / getManifest (bad username/password)', async () => {
    const client = createClient({
        maxSchemaVersion: 2,
        repo,
        username: 'fredNoExistHere',
        password: 'fredForgot',
        // log: log
    });
    await assertThrowsHttp(async () => {
        await client.getManifest({ref: 'latest'});
    }, 401);
});

Deno.test('v2 gcr.io / headBlob', async () => {
    if (!_manifest) throw new Error('cannot test');
    const client = createClient(clientOpts);
    const digest = _manifest.layers?.[0].digest;
    const ress = await client.headBlob({digest: digest!});
    assert(Array.isArray(ress), 'responses is an array');
    var first = ress[0];

    // First request statusCode on a redirect:
    // - gcr.io gives 302 (Found)
    // - docker.io gives 307
    assert([200, 302, 303, 307].indexOf(first.status) !== -1,
        'first response status code 200, 302 or 307: statusCode=' +
        first.status);

    // No digest head is returned (it's using an earlier version of the
    // registry API).
    if (first.headers.get('docker-content-digest')) {
        assertEquals(first.headers.get('docker-content-digest'), digest);
    }

    assertEquals(first.headers.get('docker-distribution-api-version'),
        'registry/2.0');

    var last = ress[ress.length - 1];
    assert(last);
    assertEquals(last.status, 200,
        'last response status code should be 200');

    // Content-Type:
    // - docker.io gives 'application/octet-stream', which is what
    //   I'd expect for the GET response at least.
    // - However gcr.io, at least for the iamge being tested, now
    //   returns text/html.
    assertEquals(last.headers.get('content-type'),
        'text/html',
        'expect specific Content-Type on last response; '
            + `statusCode=${last.status}`);

    assert(last.headers.get('content-length'));
});

Deno.test('v2 gcr.io / headBlob (unknown digest)', async () => {
    const client = createClient(clientOpts);
    await assertThrowsHttp(async () => {
        await client.headBlob({digest: 'cafebabe'});
    }, 400); // seems to be the latest code for this

    // - docker.io gives 404, which is what I'd expect
    // - gcr.io gives 400? Hrm.
    // The spec doesn't specify:
    // https://docs.docker.com/registry/spec/api/#existing-layers

    // Docker-Distribution-Api-Version header:
    // docker.io includes this header here, gcr.io does not.
    // assertEquals(res.headers['docker-distribution-api-version'],
    //    'registry/2.0');

});

Deno.test('v2 gcr.io / createBlobReadStream', async () => {
    if (!_manifestDigest || !_manifest) throw new Error('cannot test');
    const client = createClient({ repo });
    const digest = _manifest.layers[0].digest;
    const {ress, stream} = await client.createBlobReadStream({digest: digest});
    assert(ress, 'got responses');
    assert(Array.isArray(ress), 'ress is an array');

    const first = ress[0];
    assert(first.status === 200 || first.status === 307 || first.status === 302,
        `createBlobReadStream first res statusCode is 200 or 307, was ${first.status}`);
    if (first.headers.get('docker-content-digest')) {
        assertEquals(first.headers.get('docker-content-digest'), digest,
            '"docker-content-digest" header from first response is '
            + 'the queried digest');
    }
    assertEquals(first.headers.get('docker-distribution-api-version'),
        'registry/2.0',
        '"docker-distribution-api-version" header is "registry/2.0"');

    const last = ress.slice(-1)[0];
    assert(last, 'got a stream');
    assertEquals(last.status, 200);
    // Content-Type:
    // - docker.io gives 'application/octet-stream', which is what
    //   I'd expect for the GET response at least.
    // - However gcr.io, at least for the iamge being tested, now
    //   returns text/html.
    assertEquals(last.headers.get('content-type'), 'text/html');
    assert(last.headers.get('content-length') !== undefined, 'got a "content-length" header');

    var numBytes = 0;
    const hash = new Sha256();
    for await (const chunk of stream) {
        hash.update(chunk);
        numBytes += chunk.length;
    }
    assertEquals(hash.hex(), digest.split(':')[1]);
    assertEquals(numBytes, Number(last.headers.get('content-length')));
});

Deno.test('v2 gcr.io / createBlobReadStream (unknown digest)', async () => {
    const client = createClient({ repo });
    await assertThrowsHttp(async () => {
        await client.createBlobReadStream({digest: 'cafebabe'})
    }, 400);
    // - docker.io gives 404, which is what I'd expect
    // - gcr.io gives 400? Hrm.
    // The spec doesn't specify:
    // https://docs.docker.com/registry/spec/api/#existing-layers

    // Docker-Distribution-Api-Version header:
    // docker.io includes this header here, gcr.io does not.
    // assertEquals(res.headers['docker-distribution-api-version'],
    //    'registry/2.0');
});
