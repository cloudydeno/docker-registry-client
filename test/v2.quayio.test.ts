/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2017, Joyent, Inc.
 */

import { assertEquals, assert } from "https://deno.land/std@0.92.0/testing/asserts.ts";
import { createClient } from "../lib/registry-client-v2.ts";
import { parseRepo } from "../lib/common.ts";

// --- globals

const REPO = 'quay.io/coreos/etcd';
const repo = parseRepo(REPO);
// Note: Not using TAG='latest' as a workaround for
// <https://github.com/joyent/node-docker-registry-client/issues/12>.
const TAG = 'v2.0.0';

// Trent will report these to "support@quay.io" and jzelinskie on #quay IRC
const SKIP_QUAY_IO_BUGLETS = true;

// --- Tests

Deno.test('v2 quay.io / createClient', () => {
    const client = createClient({ repo });
    assertEquals(client.version, 2);
});

Deno.test('v2 quay.io / supportsV2', async () => {
    const client = createClient({ repo });
    const supportsV2 = await client.supportsV2();
    assertEquals(supportsV2, true);
});

Deno.test('v2 quay.io / ping', async () => {
    const client = createClient({ repo });
    const res = await client.ping();
    await res.arrayBuffer();
    assertEquals(res.status, 401);
    assert(res.headers.get('www-authenticate'));
    assertEquals(res.headers.get('docker-distribution-api-version'), 'registry/2.0');
});

/*
    * Example expected output:
    *  {
    *      "name": "library/alpine",
    *      "tags": [ "2.6", "2.7", "3.1", "3.2", "edge", "latest" ]
    *  }
    */
Deno.test('v2 quay.io / listTags', async () => {
    const client = createClient({ repo });
    const tags = await client.listTags();
    assertEquals(tags.name, repo.remoteName);
    assert(tags.tags.indexOf(TAG) !== -1,
        'tag "'+TAG+'" in listTags:' + JSON.stringify(tags));
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
// var manifest;
// var manifestDigest;
// Deno.test('v2 quay.io / getManifest', async () => {
//     const client = createClient({ repo });
//     client.getManifest({ref: TAG}, function (err, manifest_, res) {
//         t.ifErr(err);
//         manifest = manifest_;
//         manifestDigest = res.headers['docker-content-digest'];
//         t.ok(manifest);
//         assertEquals(manifest.schemaVersion, 1);
//         assertEquals(manifest.name, repo.remoteName);
//         assertEquals(manifest.tag, TAG);
//         t.ok(manifest.architecture);
//         t.ok(manifest.fsLayers);
//         t.ok(manifest.history[0].v1Compatibility);
//         t.ok(manifest.signatures[0].signature);
//         t.end();
//     });
// });

// Deno.test('v2 quay.io / getManifest (by digest)', async () => {
//     const client = createClient({ repo });
//     client.getManifest({ref: manifestDigest}, function (err, manifest_) {
//         t.ifErr(err);
//         t.ok(manifest);
//         ['schemaVersion',
//          'name',
//          'tag',
//          'architecture'].forEach(function (k) {
//             assertEquals(manifest_[k], manifest[k], k);
//         });
//         t.end();
//     });
// });

// Deno.test('v2 quay.io / getManifest (unknown tag)', async () => {
//     const client = createClient({ repo });
//     client.getManifest({ref: 'unknowntag'}, function (err, manifest_) {
//         t.ok(err);
//         t.notOk(manifest_);
//         assertEquals(err.statusCode, 404);
//         t.end();
//     });
// });

// Deno.test('v2 quay.io / getManifest (unknown repo)', async () => {
//     const client = createClient({ repo });
//     var badRepoClient = drc.createClientV2({
//         maxSchemaVersion: 2,
//         name: path.dirname(REPO) + '/unknownreponame',
//         log: log
//     });
//     t.ok(badRepoClient);
//     badRepoClient.getManifest({ref: 'latest'}, function (err, manifest_) {
//         t.ok(err, 'Expected an error on a missing repo');
//         t.notOk(manifest_);
//         assertEquals(err.statusCode, 404);
//         badRepoClient.close();
//         t.end();
//     });
// });

// Deno.test('v2 quay.io / getManifest (bad username/password)', async () => {
//     const client = createClient({ repo });
//     var badUserClient = drc.createClientV2({
//         maxSchemaVersion: 2,
//         repo,
//         username: 'fredNoExistHere',
//         password: 'fredForgot',
//         log: log
//     });
//     t.ok(badUserClient);
//     badUserClient.getManifest({ref: 'latest'}, function (err, manifest_) {
//         t.ok(err, 'Expected an error on a missing repo');
//         t.notOk(manifest_);
//         assertEquals(err.statusCode, 401);
//         badUserClient.close();
//         t.end();
//     });
// });

// Deno.test('v2 quay.io / headBlob', async () => {
//     const client = createClient({ repo });
//     var digest = manifest.fsLayers[0].blobSum;
//     client.headBlob({digest: digest}, function (err, ress) {
//         t.ifErr(err);
//         t.ok(ress);
//         t.ok(Array.isArray(ress));
//         var first = ress[0];
//         t.ok(first.statusCode === 200 || first.statusCode === 307);
//         assertEquals(first.headers['docker-content-digest'], digest);

//         // Docker-Distribution-Api-Version header:
//         // docker.io includes this header here, quay.io does not.
//         // assertEquals(first.headers['docker-distribution-api-version'],
//         //    'registry/2.0');

//         var last = ress[ress.length - 1];
//         t.ok(last);
//         assertEquals(last.statusCode, 200);

//         // Content-Type:
//         // - docker.io gives 'application/octet-stream', which is what
//         //   I'd expect for the GET response at least.
//         // - quay.io current v2 support gives: 'text/html; charset=utf-8'
//         if (!SKIP_QUAY_IO_BUGLETS) {
//             assertEquals(last.headers['content-type'],
//                 'application/octet-stream');
//         }

//         t.ok(last.headers['content-length']);
//         t.end();
//     });
// });

// Deno.test('v2 quay.io / headBlob (unknown digest)', async () => {
//     const client = createClient({ repo });
//     client.headBlob({digest: 'cafebabe'}, function (err, ress) {
//         t.ok(err);
//         t.ok(ress);
//         t.ok(Array.isArray(ress));
//         assertEquals(ress.length, 1);
//         // var res = ress[0];

//         // statusCode:
//         // - docker.io gives 404, which is what I'd expect
//         // - quay.io gives 405 (Method Not Allowed). Hrm.
//         // The spec doesn't specify:
//         // https://docs.docker.com/registry/spec/api/#existing-layers
//         // assertEquals(res.statusCode, 404);

//         // Docker-Distribution-Api-Version header:
//         // docker.io includes this header here, quay.io does not.
//         // assertEquals(res.headers['docker-distribution-api-version'],
//         //    'registry/2.0');

//         t.end();
//     });
// });

// Deno.test('v2 quay.io / createBlobReadStream', async () => {
//     const client = createClient({ repo });
//     var digest = manifest.fsLayers[0].blobSum;
//     client.createBlobReadStream({digest: digest},
//             function (err, stream, ress) {
//         t.ifErr(err);

//         t.ok(ress);
//         t.ok(Array.isArray(ress));
//         var first = ress[0];
//         // First request statusCode on a redirect:
//         // - quay.io gives 302 (Found)
//         // - docker.io gives 307
//         t.ok([200, 302, 307].indexOf(first.statusCode) !== -1,
//             'first request status code 200, 302 or 307: statusCode=' +
//             first.statusCode);
//         assertEquals(first.headers['docker-content-digest'], digest);

//         // Docker-Distribution-Api-Version header:
//         // docker.io includes this header here, quay.io does not.
//         // assertEquals(first.headers['docker-distribution-api-version'],
//         //    'registry/2.0');

//         t.ok(stream);
//         assertEquals(stream.statusCode, 200);

//         // Quay.io gives `Content-Type: binary/octet-stream` which has to
//         // be a bug. AFAIK that isn't a real MIME type.
//         if (!SKIP_QUAY_IO_BUGLETS) {
//             assertEquals(stream.headers['content-type'],
//                 'application/octet-stream');
//         }

//         t.ok(stream.headers['content-length']);

//         var numBytes = 0;
//         var hash = crypto.createHash(digest.split(':')[0]);
//         stream.on('data', function (chunk) {
//             hash.update(chunk);
//             numBytes += chunk.length;
//         });
//         stream.on('end', function () {
//             assertEquals(hash.digest('hex'), digest.split(':')[1]);
//             assertEquals(numBytes, Number(stream.headers['content-length']));
//             t.end();
//         });
//         stream.resume();
//     });
// });

// Deno.test('v2 quay.io / createBlobReadStream (unknown digest)', async () => {
//     const client = createClient({ repo });
//     client.createBlobReadStream({digest: 'cafebabe'},
//             function (err, stream, ress) {
//         t.ok(err);
//         t.ok(ress);
//         t.ok(Array.isArray(ress));
//         assertEquals(ress.length, 1);
//         // var res = ress[0];

//         // statusCode:
//         // - docker.io gives 404, which is what I'd expect
//         // - quay.io gives 405 (Method Not Allowed). Hrm.
//         // The spec doesn't specify:
//         // https://docs.docker.com/registry/spec/api/#existing-layers
//         // assertEquals(res.statusCode, 404);

//         // Docker-Distribution-Api-Version header:
//         // docker.io includes this header here, quay.io does not.
//         // assertEquals(res.headers['docker-distribution-api-version'],
//         //    'registry/2.0');

//         t.end();
//     });
// });
