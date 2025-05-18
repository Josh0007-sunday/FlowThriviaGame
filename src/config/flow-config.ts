// import * as fcl from "@onflow/fcl";

// const ADMIN_PRIVATE_KEY = "54011f6778ae2ccc9d0175212b225b116c37c1a94262fdcdc0369cf7ae69f723";
// const ADMIN_ACCOUNT_ADDRESS = "0x6749ea8e0a268f1a";

// fcl.config()
//   .put("accessNode.api", "https://rest-testnet.onflow.org")
//   .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn")
//   .put("0xTriviaGame", ADMIN_ACCOUNT_ADDRESS)
//   .put("0xTriviaAdmin", ADMIN_ACCOUNT_ADDRESS)
//   // Add private key provider for admin actions
//   .put("adminPrivateKey", ADMIN_PRIVATE_KEY);

// // fcl.config()
// //   .put("accessNode.api", "https://rest-testnet.onflow.org")
// //   .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn")
// //   .put("0xTriviaGame", "0x6749ea8e0a268f1a")
// //   .put("0xTriviaAdmin", "0x6749ea8e0a268f1a")
// //   .put("adminPrivateKey", ADMIN_PRIVATE_KEY);


import * as fcl from "@onflow/fcl";

const ADMIN_PRIVATE_KEY = "54011f6778ae2ccc9d0175212b225b116c37c1a94262fdcdc0369cf7ae69f723";
const ADMIN_ACCOUNT_ADDRESS = "0x6749ea8e0a268f1a";
const ADMIN_KEY_INDEX = 0; // Typically 0 unless you have multiple keys

fcl.config()
  .put("accessNode.api", "https://rest-testnet.onflow.org")
  .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn")
  .put("0xTriviaGame", ADMIN_ACCOUNT_ADDRESS)
  .put("0xTriviaAdmin", ADMIN_ACCOUNT_ADDRESS)
  .put("adminPrivateKey", ADMIN_PRIVATE_KEY)
  .put("adminAddress", ADMIN_ACCOUNT_ADDRESS)
  .put("adminKeyIndex", ADMIN_KEY_INDEX);