"use client";

import axios from "axios";
import {useAtom} from "jotai";
import React, {useCallback, useEffect, useState} from "react";
import type {Hex} from "viem";
import {createSiweMessage} from "viem/siwe";
import {useAccount, useConnect, usePublicClient, useSignMessage} from "wagmi";

import {Button} from "@recallnet/ui2/components/shadcn/button";

import {userAtom} from "@/state/atoms";
import {ConnectButton} from "@rainbow-me/rainbowkit";

export const SIWEButton: React.FunctionComponent<
  React.ComponentProps<typeof Button>
> = (props) => {
  const [message, setMessage] = useState<string>("");
  const [signature, setSignature] = useState<Hex | undefined>(undefined);
  const [, setUser] = useAtom(userAtom);

  const {signMessage} = useSignMessage({
    mutation: {
      onSuccess: (sig) => setSignature(sig),
    },
  });

  const {connect} = useConnect({
    mutation: {
      onSuccess: async (data) => {
        const {data: res} = await axios<{nonce: string}>({
          baseURL: "",
          method: "get",
          url: "/api/nonce",
          headers: {
            Accept: "application/json",
          },
          data: null,
        });

        const address = data.accounts[0];
        const chainId = data.chainId;
        const m = createSiweMessage({
          domain: document.location.host,
          address,
          chainId,
          uri: document.location.origin,
          version: "1",
          statement: "Sign with ethereum",
          nonce: res.nonce,
        });
        setMessage(m);
        signMessage({account: address, message: m});
      },
    },
  });

  const account = useAccount();
  const client = usePublicClient();

  const checkValid = useCallback(async () => {
    if (!signature || !account.address || !client || !message) return;

    const localValid = await client.verifyMessage({
      address: account.address,
      message: message,
      signature,
    });

    if (localValid) {
      try {
        const res = await axios<{ok: boolean; address: string}>({
          baseURL: "",
          method: "post",
          url: "/api/login",
          headers: {
            Accept: "application/json",
          },
          data: {message, signature},
        });

        if (res.status >= 200 && res.status < 300)
          setUser({address: account.address, loggedIn: true});
      } catch (err) {
        console.error("SIWE login failed:", err);
      }
    }
  }, [signature, account, client, message, setUser]);

  useEffect(() => {
    checkValid();
  }, [signature, account, checkValid]);

  return (
    <ConnectButton>{props.children}</ConnectButton>
  )

  //return (
  //<Button
  //onClick={() => connect({connector: cbWalletConnector})}
  //{...props}
  //>
  //{props.children}
  //</Button>
  //);
};
