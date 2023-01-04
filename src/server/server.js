import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));

const accounts = await web3.eth.getAccounts();
//web3.eth.defaultAccount = accounts[0];

let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

// used to define the range of Oracle accounts
const TEST_ORACLES_FIRST = 10;
const TEST_ORACLES_LAST = 29;

function registerOracles(index, fee, callback) {

    // console.log(`register oracle[${index}] @ ${accounts[index]} for ${fee}`);

    flightSuretyApp.methods.registerOracle()
        .send({from: accounts[index], value: fee, gas: '4500000', gasPrice: '100000000000'}, (error, result) => {
            console.log(`oracle[${index}] ${accounts[index]} registered`);

            flightSuretyApp.methods.getMyIndexes().call({from: accounts[index], gas: 200000}, (error, result) => {
                if (error) {
                    console.error(error);
                }

                if (index < TEST_ORACLES_LAST) {
                    registerOracles(index + 1, fee, callback);
                } else {
                    console.log(`${TEST_ORACLES_LAST - TEST_ORACLES_FIRST} oracle registered`);
                    callback();
                }
            });
        });
}

function submitRandomStatus(accountIdx, index, airline, flight, timestamp) {

    //console.log(`submitRandomStatus ${accountIdx} ${index}, ${airline}, ${flight}, ${timestamp} from ${accounts[accountIdx]}`);

    if (accountIdx < TEST_ORACLES_LAST) {
        flightSuretyApp.methods.getMyIndexes()
            .call({from: accounts[accountIdx], gas: 200000}, (error, indices) => {

                if (error) {
                    console.error(error);
                }

                console.log(indices);

                if (indices[0] === index || indices[1] === index || indices[2] === index) {

                    let statusCode = randomStatus();

                    //console.log(`submitOracleResponse ${index}, ${airline}, ${flight}, ${timestamp}, ${statusCode}`);

                    flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, statusCode)
                        .send({from: accounts[accountIdx], gas: 100000}, (error, result) => {
                            if (error) {
                                console.error(error);
                            }

                            console.log(`OracleResponseSubmitted ${index}, ${airline}, ${flight}, ${timestamp}, ${statusCode}`);
                            submitRandomStatus(accountIdx + 1, index, airline, flight, timestamp);
                        });
                } else {
                    console.log(`oracle ${accountIdx} doesn't have ${index}`);
                    submitRandomStatus(accountIdx + 1, index, airline, flight, timestamp);
                }
            });
    }
}

function randomIntFromInterval(min, max) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
}

/**
 * generate a random status
 * STATUS_CODE_UNKNOWN = 0;
 * STATUS_CODE_ON_TIME = 10;
 * STATUS_CODE_LATE_AIRLINE = 20;
 * STATUS_CODE_LATE_WEATHER = 30;
 * STATUS_CODE_LATE_TECHNICAL = 40;
 * STATUS_CODE_LATE_OTHER = 50;
 */
function randomStatus() {
    return randomIntFromInterval(0, 5) * 10;
}

function handleEvents() {
    flightSuretyApp.events.OracleRequest({
        fromBlock: 0
    }, function (error, event) {
        if (error) {
            console.log(error);
        }
        //console.log(event);
        console.log(`OracleRequest(index=${event.returnValues.index}, airline=${event.returnValues.airline}, flight=${event.returnValues.flight} timestamp=${event.returnValues.timestamp})`)

        submitRandomStatus(TEST_ORACLES_FIRST, event.returnValues.index, event.returnValues.airline, event.returnValues.flight, event.returnValues.timestamp);

    });
}

flightSuretyApp.methods.REGISTRATION_FEE().call().then(async fee => {

    console.log(`REGISTRATION_FEE: ${fee}`);

    registerOracles(TEST_ORACLES_FIRST, fee, handleEvents);
});


const app = express();
app.get('/api', (req, res) => {
    res.send({
        message: 'An API for use with your Dapp!'
    })
})

export default app;


