#!/usr/bin/env -S deno run

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2015, Joyent, Inc.
 */

/*
 * An example showing how a repo string is parsed.
 */

import { parseRepoAndTag } from "@cloudydeno/docker-registry-client/common";

if (Deno.args.length !== 1) {
    console.error(
        'usage:\n' +
        '    ./examples/parseRepoAndTag.ts [INDEX/]REPO[:TAG|@DIGEST]\n');
    Deno.exit(2);
}

const rat = parseRepoAndTag(Deno.args[0]);
console.log(JSON.stringify(rat, null, 4));
