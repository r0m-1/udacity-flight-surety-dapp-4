import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));

const accounts = await web3.eth.getAccounts();
web3.eth.defaultAccount = accounts[0];

let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const TEST_ORACLES_COUNT = 20;
let oracles = [];


function registerOracles(index, fee) {

    console.log(`register oracle[${index}] @ ${accounts[index]} for ${fee}`);

    flightSuretyApp.methods.registerOracle()
        .send({from: accounts[index], value: fee, gas: 4500000}, (error, result) => {
            console.log(`oracle[${index}] registered`);

            if (index < TEST_ORACLES_COUNT) {
                registerOracles(index + 1, fee);
            }
        });
}

flightSuretyApp.methods.REGISTRATION_FEE().call().then(async fee => {

    console.log(`REGISTRATION_FEE: ${fee}`);

    registerOracles(1, fee);
});


flightSuretyApp.events.OracleRequest({
    fromBlock: 0
}, function (error, event) {
    if (error) {
        console.log(error);
    }
    //console.log(event);
    console.log(`OracleRequest(index=${event.returnValues.index}, airline=${event.returnValues.airline}, flight=${event.returnValues.flight} timestamp=${event.returnValues.timestamp})`)
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
        message: 'An API for use with your Dapp!'
    })
})

export default app;


