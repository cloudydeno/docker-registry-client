#!/usr/bin/env -S deno run --allow-net

/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2017 Joyent, Inc.
 */

/* BEGIN JSSTYLED */
/*
 * This shows roughly how a Docker Engine would handle the server-side of
 * a "check auth" Remote API request:
 *      // JSSTYLED
 *      http://docs.docker.com/reference/api/docker_remote_api_v1.18/#check-auth-configuration
 * to a *v2* Docker Registry API -- as is called by `docker login`.
 *
 * Usage:
 *      node examples/login.js [-u username] [-p password] [INDEX-NAME]
 *
 * Example:
 *      $ node examples/login.js
 *      Username: bob
 *      Password:
 *
 *      login: error: token auth attempt for https://index.docker.io/v1/: https://auth.docker.io/token?service=registry.docker.io&account=bob request failed with status 401: {"details":"incorrect username or password"}
 */
/* END JSSTYLED */

import { mainline } from "../mainline.ts";
import { RegistryClientV2 } from "@cloudydeno/docker-registry-client/registry-client-v2";


// --- globals

const cmd = 'login';
const {opts, args} = mainline({ cmd });

// `docker login` with no args passes
// `serveraddress=https://index.docker.io/v1/` (yes, "v1", even for v2 reg).
const indexName = args[0] || 'https://index.docker.io/v1/';
const username = opts.username || prompt('Username:')?.trim();
const password = opts.password || prompt('Password:')?.trim();

const client = new RegistryClientV2({
    name: indexName,
    // auth info:
    username,
    password,
});
const result = await client.login();
console.log('Result:', JSON.stringify(result, null, 4));
