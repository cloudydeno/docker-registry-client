#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

/*
 * Download a complete Docker image over the v2 API. This will download
 * the manifest and all layers to files in the current directory.
 */

import { MultiProgressBar } from "https://deno.land/x/progress@v1.2.3/mod.ts";

import { mainline } from "../mainline.ts";
import { parseRepoAndRef } from "../../lib/common.ts";
import { RegistryClientV2 } from "../../lib/registry-client-v2.ts";
import { Manifest } from "../../lib/types.ts";

// Shared mainline with examples/foo.js to get CLI opts.
const {opts, args} = mainline({cmd: 'downloadImg'})
if (!args[0] || (args[0].indexOf(':') === -1 && !args[1])) {
    console.error('usage:\n' +
        '    ./examples/v2/%s.ts REPO@DIGEST\n' +
        '    ./examples/v2/%s.ts REPO:TAG\n');
    Deno.exit(2);
}

// The interesting stuff starts here.
const rar = parseRepoAndRef(args[0]);
console.log('Repo:', rar.canonicalName);
const client = new RegistryClientV2({
    repo: rar,
    insecure: opts.insecure,
    username: opts.username,
    password: opts.password,
    acceptManifestLists: false,
});

const slug = rar.localName!.replace(/[^\w]+/g, '-') + '-' +
    (rar.tag ? rar.tag : rar.digest!.slice(0, 12));

const {manifest, resp} = await client.getManifest({
    ref: rar.tag || rar.digest || '',
});
const digest = resp.headers.get('docker-content-digest');

const filename = slug + '.manifest';
await Deno.writeTextFile(filename, JSON.stringify(manifest, null, 4));
console.log('Wrote manifest:', filename);

const tasks: Array<{
    digest: string;
    idx: number;
    filename: string;
    promise?: Promise<void>;
    // bar
    text: string;
    completed: number;
    total?: number;
}> = getLayersFromManifest(manifest).map(({digest, size}, idx) => ({
    digest, idx: idx+1,
    filename: `${slug}-${idx+1}.${digest.split(':')[1].slice(0, 12)}.layer`,
    text: digest.slice(0, 12),
    completed: 0,
    total: size,
}));

const bars = new MultiProgressBar({
    clear: true,
    interval: 250,
    incomplete: '-',
    complete: '=',
    display: '[:bar] :text :percent :time :completed/:total',
});
const timer = setInterval(() => {
    bars.render(tasks);
}, 250);

for (const task of tasks) {
    task.promise = (async () => {
        const {ress, stream} = await client.createBlobReadStream({
            digest: task.digest,
        });
        if (!task.total) {
            task.total = Number(ress.slice(-1)[0].headers.get('content-length') || 1);
        }

        const file = await Deno.create(task.filename);
        for await (const buf of stream) {
            await Deno.writeAll(file, buf);

            task.completed += buf.byteLength;
            if (task.completed > task.total) {
                task.total = task.completed;
            }
        }

        // flush the full bar... not sure why this is needed.
        bars.render(tasks);
        task.completed++;

        bars.console(`Downloaded layer ${task.idx} of ${tasks.length}: ${task.filename}`);
        file.close();
    })();
}

await Promise.all(tasks.map(x => x.promise));
clearInterval(timer);
bars.render(tasks);

console.log('Digest:', digest);


function getLayersFromManifest(manifest: Manifest): Array<{
    digest: string;
    size?: number;
}> {
    if (manifest.schemaVersion === 1) {
        return manifest.fsLayers.map(layer => ({digest: layer.blobSum})).reverse();
    }
    if (manifest.schemaVersion === 2) {
        if (manifest.mediaType === 'application/vnd.docker.distribution.manifest.list.v2+json') throw new Error(`Got a manifest list for some reason`);
        return manifest.layers.map(layer => ({
            digest: layer.digest,
            size: layer.size,
        }));
    }
    return [];
}
