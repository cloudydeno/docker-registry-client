/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2015, Joyent, Inc.
 */

import { DockerResponse, RegistryError } from "./types.ts";

/*
 * Error classes that docker-registry-client may produce.
 */

/** Base class for custom error classes. */
export class ApiError extends Error {
    constructor(message: string, init?: { cause?: any; }) {
        super(message, init);
        this.name = new.target.name;
        Error.captureStackTrace?.(this, new.target);
    }
}

export class HttpError extends ApiError {
    override name = 'HttpError';
    constructor(
        public resp: DockerResponse,
        public errors: RegistryError[],
        message: string,
    ) {
        super(message);
    }
}
export class BadDigestError extends ApiError {
    override readonly name = 'BadDigestError';
}
export class InvalidContentError extends ApiError {
    override readonly name = 'InvalidContentError';
}

export class InternalError extends ApiError {
    override readonly name = 'InternalError';
}

export class ManifestVerificationError extends ApiError {
    override readonly name = 'ManifestVerificationError';
}

export class InvalidManifestError extends ApiError {
    override readonly name = 'InvalidManifestError';
}

export class DownloadError extends ApiError {
    override readonly name = 'DownloadError';
}

export class UploadError extends ApiError {
    override readonly name = 'UploadError';
}

// export class UnauthorizedError extends HttpError {
//     readonly name = 'UnauthorizedError';
//     readonly statusCode = 401;
// }

export class TooManyRedirectsError extends ApiError {
    override readonly name = 'TooManyRedirectsError';
}
