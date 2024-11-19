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

export class InvalidValue extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidValue";
  }
}

// Handle objects API error: {"code":400,"message":"object rzghyg4z3p6vbz5jkgc75lk64fci7kieul65o6hk6xznx7lctkmq is not available"}
export class ObjectNotAvailable extends Error {
  constructor(key: string, blobHash: string) {
    super(`Object not available: unrecoverable key '${key}' with blob hash '${blobHash}'`);
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
