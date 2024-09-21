// Forked & converted to use `bigint` & `Uint8Array`
// Source: https://github.com/Zondax/izari-filecoin/blob/master/src/address/errors.ts
export class InvalidProtocolIndicator extends Error {
  constructor(value: number) {
    super();
    this.message = `Invalid protocol indicator byte [${value}]`;
  }
}

export class UnknownProtocolIndicator extends Error {
  constructor(value: number) {
    super();
    this.message = `Unknown protocol indicator byte [${value}]`;
  }
}

export class InvalidPayloadLength extends Error {
  constructor(len: number) {
    super();
    this.message = `Invalid payload length [${len}]`;
  }
}

export class InvalidNamespace extends Error {
  constructor(value: string) {
    super();
    this.message = `Invalid namespace [${value}]`;
  }
}
export class InvalidNetwork extends Error {
  constructor(value: string) {
    super();
    this.message = `Invalid network [${value}]`;
  }
}

export class InvalidSubAddress extends Error {
  constructor() {
    super();
    this.message = "Invalid subAddress.";
  }
}

export class InvalidId extends Error {
  constructor(id: string) {
    super();
    this.message = `Invalid id [${id}]`;
  }
}

export class ProtocolNotSupported extends Error {
  constructor(protocolName: string) {
    super();
    this.message = `${protocolName} protocol not supported.`;
  }
}

export class InvalidChecksumAddress extends Error {
  constructor(checksum1: string, checksum2: string) {
    super();
    this.message = `Invalid address (checksum not matching the payload). ${checksum1} vs ${checksum2}`;
  }
}

export class InvalidPrivateKeyFormat extends Error {
  constructor() {
    super();
    this.message =
      "Private key need to be an instance of Buffer or a base64 string.";
  }
}
