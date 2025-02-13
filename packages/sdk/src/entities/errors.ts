import { Address } from "viem";

import { FilEthAddress } from "@recall/fvm/address";

export class BucketNotFound extends Error {
  constructor(bucket: string) {
    super(`Bucket not found: '${bucket}'`);
    this.name = "BucketNotFound";
  }
}

export class CreateBucketError extends Error {
  constructor(message: string) {
    super(`Failed to create bucket: ${message}`);
    this.name = "CreateBucketError";
  }
}

export class AddObjectError extends Error {
  constructor(message: string) {
    super(`Failed to add object: ${message}`);
    this.name = "AddObjectError";
  }
}

export class InvalidValue extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidValue";
  }
}

// Handle objects API error: {"code":400,"message":"object rzghyg4z3p6vbz5jkgc75lk64fci7kieul65o6hk6xznx7lctkmq is not available"}
export class ObjectNotAvailable extends Error {
  constructor(key: string, blobHash: string) {
    super(
      `Object not available: unrecoverable key '${key}' with blob hash '${blobHash}'`,
    );
    this.name = "ObjectNotAvailable";
  }
}

export class ObjectNotFound extends Error {
  constructor(bucket: string, key: string) {
    super(`Object not found: no key '${key}' in bucket '${bucket}'`);
    this.name = "ObjectNotFound";
  }
}

export class UnhandledBucketError extends Error {
  constructor(message: string) {
    super(`Bucket error: ${message}`);
    this.name = "UnhandledBucketError";
  }
}

export class UnhandledCreditError extends Error {
  constructor(message: string) {
    super(`Credit error: ${message}`);
    this.name = "UnhandledCreditError";
  }
}
export class UnhandledBlobError extends Error {
  constructor(message: string) {
    super(`Blob error: ${message}`);
    this.name = "UnhandledBlobError";
  }
}

export class UnhandledGatewayError extends Error {
  constructor(message: string) {
    super(`Gateway error: ${message}`);
    this.name = "UnhandledGatewayError";
  }
}

export class InsufficientFunds extends Error {
  constructor(amount: bigint) {
    super(`Insufficient funds: balance less than amount '${amount}'`);
    this.name = "InsufficientFunds";
  }
}

// Check error message for actor not found; it can happen in two different ways:
// ```
// 02: t066 (method 3435393067) -- actor f410... not found (17)
// --> caused by: actor::resolve_address -- actor not found (6: resource not found)
// ```
// Or:
// ```
// 02: t017 (method 2283215593) -- failed to resolve actor for address f410... (16)
// --> caused by: actor::resolve_address -- actor not found (6: resource not found)
// ```
export interface ActorNotFoundResult {
  isActorNotFound: boolean;
  address: Address | null;
}

// Check if the error message is an actor not found error, and include the hex address if it is
export function isActorNotFoundError(error: Error): ActorNotFoundResult {
  const isActorNotFound = error.message.includes(
    "actor::resolve_address -- actor not found",
  );
  const addressMatch = error.message.match(/f410[a-z0-9]+/i);

  return {
    isActorNotFound,
    address: addressMatch
      ? (FilEthAddress.fromString(addressMatch[0]).toEthAddressHex() as Address)
      : null,
  };
}

export class ActorNotFound extends Error {
  constructor(address: Address) {
    super(
      `Actor not found (hint: ensure the address is registered: '${address}')`,
    );
    this.name = "ActorNotFound";
  }
}
