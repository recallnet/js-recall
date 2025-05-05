import {createAuthenticationAdapter} from '@rainbow-me/rainbowkit';
import {createSiweMessage} from 'viem/siwe';
import axios from 'axios';

export const authAdapter = createAuthenticationAdapter({
  getNonce: async () => {
    const {data: res} = await axios<{nonce: string}>({
      baseURL: "",
      method: "get",
      url: "/api/nonce",
      headers: {
        Accept: "application/json",
      },
      data: null,
    });

    return res.nonce
  },
  createMessage: ({nonce, address, chainId}) => {
    return createSiweMessage({
      domain: document.location.host,
      address,
      statement: 'Sign in with Ethereum to the app.',
      uri: document.location.origin,
      version: '1',
      chainId,
      nonce,
    });
  },
  verify: async ({message, signature}) => {
    const res = await axios<{ok: boolean; address: string}>({
      baseURL: "",
      method: "post",
      url: "/api/login",
      headers: {
        Accept: "application/json",
      },
      data: {message, signature},
    });

    return res.data.ok
  },
  signOut: async () => {
    console.log('SIGN OUT')
    //await fetch('/api/logout');
  },
});
