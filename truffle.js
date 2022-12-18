require('dotenv').config();

const HDWalletProvider = require('@truffle/hdwallet-provider');
const {INFURA_API_KEY, MNEMONIC} = process.env;

module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",
            port: 7545,
            network_id: "*" // Match any network id
        },
        goerli: {
            provider: () => new HDWalletProvider(MNEMONIC, INFURA_API_KEY),
            network_id: 5,
            gas: 4500000,
            timeoutBlocks: 50000
        },
    },
    compilers: {
        solc: {
            version: "0.8.17"
        }
    }
};