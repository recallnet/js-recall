import { expect } from "chai";
import { describe, it } from "mocha";
import { Account } from "../src/account.js";
import { Network } from "../src/network.js";
import { Wallet } from "../src/wallet.js";

describe.only("wallet", function () {
  const pk = "pk_val";

  this.timeout(90000);

  it.skip("should create a wallet and get parent balance", async () => {
    const network = new Network();
    const wallet = new Wallet(pk, network.parentSubnetConfig());
    const account = new Account(wallet);
    const balance = await account.balance();
    console.log(balance);
    expect(balance).to.not.equal(0n);
  });

  it.skip("should create a wallet and get child balance", async () => {
    const network = new Network();
    const wallet = new Wallet(pk, network.subnetConfig());
    const account = new Account(wallet);
    const balance = await account.balance();
    expect(balance).to.be.equal(0n);
  });

  it.skip("should approve gateway funding", async () => {
    const network = new Network();
    const wallet = new Wallet(pk, network.parentSubnetConfig());
    const account = new Account(wallet);
    const rec = await account.approveGateway(1);
    expect(rec).to.not.be.equal(null);
  });

  it.skip("should approve gateway deposit", async () => {
    const network = new Network();
    const wallet = new Wallet(pk, network.parentSubnetConfig());
    const account = new Account(wallet);
    const rec = await account.deposit(1);
    expect(rec).to.not.be.equal(null);
  });

  it("should approve gateway withdraw", async () => {
    const network = new Network();
    const wallet = new Wallet(pk, network.parentSubnetConfig());
    const account = new Account(wallet);
    const rec = await account.withdraw();
    expect(rec).to.not.be.equal(null);
  });

  it.skip("should transfer on parent", async () => {
    const network = new Network();
    const wallet = new Wallet(pk, network.parentSubnetConfig());
    const account = new Account(wallet);
    const rec = await account.transfer(
      "0xc05FE6B63ffA4b3c518e6FF1E597358Ee839dB01",
      1
    );
    expect(rec).to.not.be.equal(null);
  });
});
