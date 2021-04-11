
export interface RegistryIndex {
  name: string;
  official?: boolean;
  scheme: string;
}

export interface RegistryImage {
  index: RegistryIndex;
  remoteName?: string;
  localName?: string;
  canonicalName?: string;
  official?: boolean;
  digest?: string;
  tag?: string;
}


export interface TagList {
  name: string;
  tags: string[];
  // these seem GCR specific:
  child?: string[];
  manifest?: Record<string, {
      imageSizeBytes: string;
      layerId?: string;
      mediaType: string;
      tag: string[];
      timeCreatedMs: string;
      timeUploadedMs: string;
  }>;
};


export type Manifest =
| ManifestV1
| ManifestV2
| ManifestV2List
;

export interface ManifestV1 {
  schemaVersion: 1;

  name: string;
  tag: string;
  /** architecture is the host architecture on which this image is intended to run. */
  architecture: string;
  /** fsLayers is a list of filesystem layer blob sums contained in this image. */
  fsLayers: Array<{
    blobSum: string;
  }>;
  history: Array<{
    /** This will contain the JSON object describing the V1 of this image. */
    v1Compatibility: string;
  }>;
  signatures?: Array<{
    header: Record<string, any>; // JOSE header
    /** The signed protected header */
    protected: string;
    /** A signature for the image manifest, signed by a libtrust private key */
    signature: string;
  }>;
}

export interface ManifestV2 {
  schemaVersion: 2;
  mediaType: "application/vnd.docker.distribution.manifest.v2+json";
  config: {
    mediaType: string;
    size: number;
    digest: string;
  };
  layers: Array<{
    mediaType: string;
    size: number;
    digest: string;
    urls?: string[];
  }>;
}

export interface ManifestV2List {
  schemaVersion: 2;
  mediaType: "application/vnd.docker.distribution.manifest.list.v2+json";
  manifests: Array<{
    mediaType: string;
    digest: string;
    size: number;
    platform: {
      "architecture": string;
      "os": string;
      "os.version"?: string; // windows version
      "os.features"?: string[];
      "variant"?: string; // cpu variant
      "features"?: string[]; // cpu features
    };
  }>;
}


export interface RegistryClientOpts {
  name?: string; // mutually exclusive with repo
  repo?: RegistryImage;
  // log
  username?: string;
  password?: string;
  token?: string; // for bearer auth
  insecure?: boolean;
  scheme?: string;
  acceptManifestLists?: boolean;
  maxSchemaVersion?: number;
  userAgent?: string;
  scopes?: string[];
};


export type AuthInfo =
| { type: 'None'; }
| { type: 'Basic';
    username: string;
    password: string;
  }
| { type: 'Bearer';
    token: string;
  }
;


export interface DockerResponse extends Response {
  dockerBody(): Promise<Uint8Array>;
  dockerJson(): Promise<unknown>;
  dockerStream(): ReadableStream<Uint8Array>;

  dockerErrors(): Promise<Array<RegistryError>>;
  dockerThrowable(baseMsg: string): Promise<Error>;
}

export interface RegistryError {
  code?: string;
  message: string;
  detail?: string;
};
