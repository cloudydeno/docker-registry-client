/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2017, Joyent, Inc.
 */

/*
 * Specifically we want to test a repo name with a '/'.
 * See <https://github.com/joyent/node-docker-registry-client/issues/16>.
 */

import {
    assert, assertEquals, assertThrowsHttp,
    getFirstLayerDigestFromManifest,
    hashAndCount,
    dirname,
} from "./util.ts";

import { createClient, MEDIATYPE_MANIFEST_LIST_V2, MEDIATYPE_MANIFEST_V2 } from "../lib/registry-client-v2.ts";
import { parseRepo } from "../lib/common.ts";
import { ManifestV2 } from "../lib/types.ts";

// --- globals

const REPO = 'registry.gitlab.com/masakura/docker-registry-client-bug-sample/image';
const TAG = 'hello-world';


// --- Tests

const repo = parseRepo(REPO);

Deno.test('v2 registry.gitlab.com / createClient', async () => {
    const client = createClient({ repo });
    assert(client);
    assertEquals(client.version, 2);
});

Deno.test('v2 registry.gitlab.com / ping', async () => {
    const client = createClient({ repo });
    const res = await client.ping();
    assert(res, 'have a response');
    assertEquals(res.status, 401);
    assert(res.headers.get('www-authenticate'));
});

/*
    * Example expected output:
    *  {
    *      "name": "library/alpine",
    *      "tags": [ "2.6", "2.7", "3.1", "3.2", "edge", "latest" ]
    *  }
    */
Deno.test('v2 registry.gitlab.com / listTags', async () => {
    const client = createClient({ repo });
    const tags = await client.listTags();
    assert(tags);
    assertEquals(tags.name, repo.remoteName);
    assert(tags.tags.indexOf(TAG) !== -1, 'have a "'+TAG+'" tag');
});

/*
    *  {
    *      "name": <name>,
    *      "tag": <tag>,
    *      "fsLayers": [
    *         {
    *            "blobSum": <tarsum>
    *         },
    *         ...
    *      ],
    *      "history": <v1 images>,
    *      "signature": <JWS>
    *  }
    */
// Seems like Gitlab isn't serving up v2.1 anymore.
// Deno.test('v2 registry.gitlab.com / getManifest (v2.1)', async () => {
//     const client = createClient({ repo });
//     const {manifest} = await client.getManifest({ref: TAG});
//     assert(manifest);
//     assertEquals(manifest.schemaVersion, 1);
//     assert(manifest.schemaVersion === 1);
//     assertEquals(manifest.name, repo.remoteName);
//     assertEquals(manifest.tag, TAG);
//     assert(manifest.architecture);
//     assert(manifest.fsLayers);
//     assert(manifest.history[0].v1Compatibility);
//     assert(manifest.signatures?.[0].signature);
// });

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
Deno.test('v2 registry.gitlab.com / getManifest (v2.2)', async () => {
    const client = createClient({ repo });
    var getOpts = {ref: TAG, maxSchemaVersion: 2};
    const {manifest, resp} = await client.getManifest(getOpts);
    _manifestDigest = resp.headers.get('docker-content-digest');
    assertEquals(manifest.schemaVersion, 2);
    assert(manifest.schemaVersion === 2);
    assert(manifest.mediaType === MEDIATYPE_MANIFEST_V2);
    _manifest = manifest;
    assert(manifest.config);
    assert(manifest.config.digest, manifest.config.digest);
    assert(manifest.layers);
    assert(manifest.layers.length > 0);
    assert(manifest.layers[0].digest);
});

/*
    * Note this test requires that the manifest be pulled in the v2.2 format,
    * otherwise you will get a manifest not found error.
    */
Deno.test('v2 registry.gitlab.com / getManifest (by digest)', async () => {
    const client = createClient({ repo });
    const {manifest} = await client.getManifest({
        ref: _manifestDigest!,
    });
    assert(manifest);
    assertEquals(_manifest!.schemaVersion, manifest.schemaVersion);
    assert(manifest.schemaVersion === 2);
    assert(manifest.mediaType === MEDIATYPE_MANIFEST_V2);
    assertEquals(_manifest!.config, manifest.config);
    assertEquals(_manifest!.layers, manifest.layers);
});

Deno.test('v2 registry.gitlab.com / getManifest (unknown tag)', async () => {
    const client = createClient({ repo });
    await assertThrowsHttp(async () => {
        await client.getManifest({ref: 'unknowntag'});
    }, 404);
});

Deno.test('v2 registry.gitlab.com / getManifest (unknown repo)', async () => {
    const client = createClient({
        name: dirname(REPO) + '/unknownreponame',
    });
    await assertThrowsHttp(async () => {
        await client.getManifest({ref: 'latest'});
    }, 404);
});

Deno.test('v2 registry.gitlab.com / getManifest (bad username/password)', async () => {
    const client = createClient({
        repo,
        username: 'fredNoExistHere',
        password: 'fredForgot',
    });
    await assertThrowsHttp(async () => {
        await client.getManifest({ref: 'latest'});
    }, 401);
});

Deno.test('v2 registry.gitlab.com / headBlob', async () => {
    if (!_manifestDigest || !_manifest) throw new Error('cannot test');
    const client = createClient({ repo });
    var digest = getFirstLayerDigestFromManifest(_manifest);
    const ress = await client.headBlob({digest: digest});
    assert(ress, 'got a "ress"');
    assert(Array.isArray(ress), '"ress" is an array');
    var first = ress[0];
    assert(first.status === 200 || first.status === 307,
        'first response statusCode is 200 or 307');
    if (first.headers.get('docker-content-digest')) {
        assertEquals(first.headers.get('docker-content-digest'), digest,
            '"docker-content-digest" header from first response is '
            + 'the queried digest');
    }
    assertEquals(first.headers.get('docker-distribution-api-version'),
        'registry/2.0',
        '"docker-distribution-api-version" header is "registry/2.0"');
    var last = ress[ress.length - 1];
    assertEquals(last.status, 200, 'last response statusCode is 200');
    var contentType = last.headers.get('content-type');
    assert(['application/octet-stream', 'application/x-gzip']
        .indexOf(contentType ?? '') !== -1,
        'content-type is as expected, got ' + contentType);
    assert(last.headers.get('content-length'));
});

Deno.test('v2 registry.gitlab.com / headBlob (unknown digest)', async () => {
    const client = createClient({ repo });
    const {resp} = await assertThrowsHttp(async () => {
        await client.headBlob({digest: 'cafebabe'});
    }, 404);
    assertEquals(resp.headers.get('docker-distribution-api-version'),
        'registry/2.0');
});

Deno.test('v2 registry.gitlab.com / createBlobReadStream', async () => {
    if (!_manifestDigest || !_manifest) throw new Error('cannot test');
    const client = createClient({ repo });
    const digest = getFirstLayerDigestFromManifest(_manifest);
    const {ress, stream} = await client.createBlobReadStream({digest: digest});
    assert(ress, 'got responses');
    assert(Array.isArray(ress), 'ress is an array');

    const first = ress[0];
    assert(first.status === 200 || first.status === 307,
        'createBlobReadStream first res statusCode is 200 or 307');
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
    assertEquals(last.status, 200, 'stream statusCode is 200');
    assertEquals(last.headers.get('content-type'), 'application/octet-stream');
    assert(last.headers.get('content-length') !== undefined,
        'got a "content-length" header');

    const {hashHex, numBytes} = await hashAndCount(digest.split(':')[0], stream);
    assertEquals(hashHex, digest.split(':')[1]);
    assertEquals(numBytes, Number(last.headers.get('content-length')));
});

Deno.test('v2 registry.gitlab.com / createBlobReadStream (unknown digest)', async () => {
    const client = createClient({ repo });
    const {resp} = await assertThrowsHttp(async () => {
        await client.createBlobReadStream({digest: 'cafebabe'})
    }, 404);
    assertEquals(resp.headers.get('docker-distribution-api-version'),
        'registry/2.0');
});
