/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

export * from './types.ts';

export {
    RegistryClientV2,
    digestFromManifestStr,
} from "./registry-client-v2.ts";

export {
    MEDIATYPE_MANIFEST_V2,
    MEDIATYPE_MANIFEST_LIST_V2,
    MEDIATYPE_OCI_MANIFEST_V1,
    MEDIATYPE_OCI_MANIFEST_INDEX_V1,

    DEFAULT_INDEX_NAME,
    DEFAULT_TAG,

    parseRepo,
    parseIndex,
    parseRepoAndRef,
    // Using `parseRepoAndRef` is preferred over `parseRepoAndTag`.
    parseRepoAndTag,
} from "./common.ts";

export {
    ApiError as RegistryApiError,
    HttpError as RegistryHttpError,
} from "./errors.ts";
