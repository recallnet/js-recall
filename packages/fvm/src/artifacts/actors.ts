// Forked from https://github.com/Zondax/izari-filecoin/blob/master/src/artifacts/actors.ts

/**
 * System singleton actor ids
 * For more information about system actors, please refer to this {@link https://spec.filecoin.io/systems/filecoin_vm/sysactors/#section-systems.filecoin_vm.sysactors.initactor|link}
 */
export enum SystemActorIDs {
  System = 0,
  Init = 1,
  Reward = 2,
  Cron = 3,
  StoragePower = 4,
  StorageMarket = 5,
  VerifiedRegistry = 6,
  DataCap = 7,
  EAM = 10,
  // Hoku actors
  ADM = 17,
}

/**
 * Init actor methods
 * For more information about this type, please refer to this {@link https://github.com/filecoin-project/builtin-actors/blob/master/actors/init/src/lib.rs|code}
 */
export enum InitActorMethods {
  Exec = 2,
  Exec4 = 3,
}

/**
 * Payment channel actor methods
 * For more information about this type, please refer to this {@link https://github.com/filecoin-project/builtin-actors/blob/master/actors/paych/src/lib.rs|code}
 */
export enum PayChActorMethods {
  UpdateChannelState = 2,
  Settle = 3,
  Collect = 4,
}

/**
 * Actor content IDs version 12 for calibration network
 * For more information about the actors cid v10, please refer to this {@link https://github.com/filecoin-project/lotus/releases/tag/v1.20.0|link}
 */
// TODO: validate correctness
export enum ActorsCalibrationV12 {
  Account = "bafk2bzacechwwxdqvggkdylm37zldjsra2ivkdzwp7fee56bzxbzs544wv6u6",
  Cron = "bafk2bzacec4gdxxkqwxqqodsv6ug5dmdbqdfqwyqfek3yhxc2wweh5psxaeq6",
  DataCap = "bafk2bzacecq5ppfskxgv3iea3jarsix6jdduuhwsn4fbvngtbmzelzmlygorm",
  EAM = "bafk2bzacecb6cnwftvavpph4p34zs4psuy5xvbrhf7vszkva4npw6mw3c42xe",
  EthAccount = "bafk2bzaceajmc3y3sedsqymfla3dzzqzmbu5kmr2iskm26ga2u34ll5fpztfw",
  EVM = "bafk2bzaced4sozr7m6rzcgpobzeiupghthfw6afumysu3oz6bxxirv74uo3vw",
  Init = "bafk2bzaceaewh7b6zl2egclm7fqzx2lsqr57i75lb6cj43ndoa4mal3k5ld3m",
  Multisig = "bafk2bzacednkwcpw5yzxjceoaliajgupzj6iqxe7ks2ll3unspbprbo5f2now",
  PaymentChannel = "bafk2bzacebaxhk4itfiuvbftg7kz5zxugqnvdgerobitjq4vl6q4orcwk6wqg",
  Placeholder = "bafk2bzacedfvut2myeleyq67fljcrw4kkmn5pb5dpyozovj7jpoez5irnc3ro",
  Reward = "bafk2bzacedra77pcglf7vdca2itcaa4vd6xrxynxmgfgdjdxqxfwqyhtoxehy",
  StorageMarket = "bafk2bzacea7g46y7xxu2zjq2h75x6mmx3utz2uxnlvnwi6tzpsvulna3bmiva",
  StorageMiner = "bafk2bzaced7emkbbnrewv5uvrokxpf5tlm4jslu2jsv77ofw2yqdglg657uie",
  StoragePower = "bafk2bzacedd3ka44k7d46ckbinjhv3diyuu2epgbyvhqqyjkc64qlrg3wlgzi",
  System = "bafk2bzacecioupndtcnyw6iq2hbrxag3aufvczlv5nobnfbkbywqzcyfaa376",
  VerifiedRegistry = "bafk2bzaceavldupmf7bimeeacs67z5xdfdlfca6p7sn6bev3mt5ggepfqvhqo",
}

/**
 * Actor content IDs version 11 for calibration network
 * For more information about the actors cid v10, please refer to this {@link https://github.com/filecoin-project/lotus/releases/tag/v1.20.0|link}
 */
// TODO: validate correctness
export enum ActorsCalibrationV11 {
  Account = "bafk2bzacebor5mnjnsav34cmm5pcd3dy4wubbv4wtcrvba7depy3sct7ie4sy",
  Cron = "bafk2bzacebetehhedh55alfn4rcx2mhjhvuiustxlhtxc3drkemnpttws5eqw",
  DataCap = "bafk2bzaced6uhmrh5jjexhw4lco4ipesi2iutl7uupnyspgmnbydyo3amtu4i",
  EAM = "bafk2bzacea6wzcnflfnaxqnwydoghh7ezg5au32ew3bnzljzpiw6fimhlpoiu",
  EthAccount = "bafk2bzacedrbpvjvyzif2cjxosm4pliyq2m6wzndvrg7r6hzdhixplzvgubbw",
  EVM = "bafk2bzaceabftmhejmvjvpzmbsv4cvaew6v5juj5sqtq7cfijugwsnahnsy5w",
  Init = "bafk2bzaceduyjd35y7o2lhvevtysqf45rp5ot7x5f36q6iond6dyiz6773g5q",
  Multisig = "bafk2bzacebcb72fmbpocetnzgni2wnbrduamlqx6fl3yelrlzu7id6bu5ib5g",
  PaymentChannel = "bafk2bzaceazwhm63kyp47pste5i5acnuhosrgythyagf3kc5clogiqqx6vkzk",
  Placeholder = "bafk2bzacedfvut2myeleyq67fljcrw4kkmn5pb5dpyozovj7jpoez5irnc3ro",
  Reward = "bafk2bzacecp7xo5ev46y64zr5osnn5fxo7itpoqw235tcfv6eo4rymzdemet2",
  StorageMarket = "bafk2bzacedjt5mueomasx7dijooxnwxsbtzu2dj2ppp45rtle4kiinkmgzeei",
  StorageMiner = "bafk2bzacebkjnjp5okqjhjxzft5qkuv36u4tz7inawseiwi2kw4j43xpxvhpm",
  StoragePower = "bafk2bzaced2qsypqwore3jrdtaesh4itst2fyeepdsozvtffc2pianzmphdum",
  System = "bafk2bzacedqvik2n3phnj3cni3h2k5mtvz43nyq7mdmv7k7euejysvajywdug",
  VerifiedRegistry = "bafk2bzaceceoo5jlom2zweh7kpye2vkj33wgqnkjshlsw2neemqkfg5g2rmvg",
}

/**
 * Actor content IDs version 10 for mainnet network
 * For more information about the actors cid v10, please refer to this {@link https://github.com/filecoin-project/lotus/releases/tag/v1.20.0|link}
 */
// TODO: validate correctness
export enum ActorsMainnetV10 {
  Account = "bafk2bzaceampw4romta75hyz5p4cqriypmpbgnkxncgxgqn6zptv5lsp2w2bo",
  Cron = "bafk2bzacedcbtsifegiu432m5tysjzkxkmoczxscb6hqpmrr6img7xzdbbs2g",
  DataCap = "bafk2bzacealj5uk7wixhvk7l5tnredtelralwnceafqq34nb2lbylhtuyo64u",
  EAM = "bafk2bzacedrpm5gbleh4xkyo2jvs7p5g6f34soa6dpv7ashcdgy676snsum6g",
  EthAccount = "bafk2bzaceaqoc5zakbhjxn3jljc4lxnthllzunhdor7sxhwgmskvc6drqc3fa",
  EVM = "bafk2bzaceahmzdxhqsm7cu2mexusjp6frm7r4kdesvti3etv5evfqboos2j4g",
  Init = "bafk2bzaced2f5rhir3hbpqbz5ght7ohv2kgj42g5ykxrypuo2opxsup3ykwl6",
  Multisig = "bafk2bzaceduf3hayh63jnl4z2knxv7cnrdenoubni22fxersc4octlwpxpmy4",
  PaymentChannel = "bafk2bzaceartlg4mrbwgzcwric6mtvyawpbgx2xclo2vj27nna57nxynf3pgc",
  Placeholder = "bafk2bzacedfvut2myeleyq67fljcrw4kkmn5pb5dpyozovj7jpoez5irnc3ro",
  Reward = "bafk2bzacebnhtaejfjtzymyfmbdrfmo7vgj3zsof6zlucbmkhrvcuotw5dxpq",
  StorageMarket = "bafk2bzaceclejwjtpu2dhw3qbx6ow7b4pmhwa7ocrbbiqwp36sq5yeg6jz2bc",
  StorageMiner = "bafk2bzaced4h7noksockro7glnssz2jnmo2rpzd7dvnmfs4p24zx3h6gtx47s",
  StoragePower = "bafk2bzacec4ay4crzo73ypmh7o3fjendhbqrxake46bprabw67fvwjz5q6ixq",
  System = "bafk2bzacedakk5nofebyup4m7nvx6djksfwhnxzrfuq4oyemhpl4lllaikr64",
  VerifiedRegistry = "bafk2bzacedfel6edzqpe5oujno7fog4i526go4dtcs6vwrdtbpy2xq6htvcg6",
}
