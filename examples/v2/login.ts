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
 * Run with -v for more more verbose logging.
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
import { RegistryClientV2 } from "../../lib/registry-client-v2.ts";


// --- globals

const {opts, args} = mainline({cmd: 'login'});

// `docker login` with no args passes
// `serveraddress=https://index.docker.io/v1/` (yes, "v1", even for v2 reg).
var indexName = args[0] || 'https://index.docker.io/v1/';
var username = opts.username || prompt('Username:')?.trim();
var password = opts.password || prompt('Password:')?.trim();

const client = new RegistryClientV2({
    name: indexName,
    // auth info:
    username: username,
    password: password,
});
const result = await client.login();
console.log('Result:', JSON.stringify(result, null, 4));
