"use client";

import {useCallback, useEffect, useState} from "react";
import type {Hex} from "viem";
import axios from "axios";
import {useAccount, useConnect, usePublicClient, useSignMessage} from "wagmi";
import {SiweMessage} from "siwe";
import {cbWalletConnector} from "@/wagmi-config";

export function ConnectAndSIWE() {
  const [message, setMessage] = useState<SiweMessage | undefined>(undefined);
  const [signature, setSignature] = useState<Hex | undefined>(undefined);
  const [valid, setValid] = useState<boolean | undefined>(undefined);

  const {signMessage} = useSignMessage({
    mutation: {
      onSuccess: (sig) => setSignature(sig),
    },
  });

  const {connect} = useConnect({
    mutation: {
      onSuccess: async (data) => {
        const res = await axios<{nonce: number}>({
          baseURL: '',
          method: 'get',
          url: '/api/nonce',
          headers: {
            Accept: 'application/json',
          },
          data: null
        })

        const address = data.accounts[0];
        const chainId = data.chainId;
        const m = new SiweMessage({
          domain: document.location.host,
          address,
          chainId,
          uri: document.location.origin,
          version: "1",
          statement: "Smart Wallet SIWE Example",
          nonce: res.nonce,
        });
        setMessage(m);
        console.log('HEREEE', address)
        signMessage({account: address, message: m.prepareMessage()});
      },
    },
  });
  console.log('MESSAGE', message, Boolean(signature))

  const account = useAccount();
  const client = usePublicClient();

  const checkValid = useCallback(async () => {
    if (!signature || !account.address || !client || !message) return;

    const localValid = await client.verifyMessage({
      address: account.address,
      message: message.prepareMessage(),
      signature,
    });

    setValid(localValid);

    if (localValid) {
      try {
        const res = await axios<{ok: boolean, address: string}>({
          baseURL: '',
          method: 'post',
          url: '/api/login',
          headers: {
            Accept: 'application/json',
          },
          data: {message, signature}
        })


        console.log("Login response:", res.data);
      } catch (err) {
        console.error("SIWE login failed:", err);
      }
    }
  }, [signature, account, client, message]);

  useEffect(() => {
    checkValid();
  }, [signature, account]);

  return (
    <div>
      <button onClick={() => {
        try {
          connect({connector: cbWalletConnector})
        } catch (err) {
          console.log('ERROR ON CLICK', err)
        }
      }}>
        Connect + SIWE
      </button>
      {valid !== undefined && <p>Is valid: {valid.toString()}</p>}
    </div>
  );
}

