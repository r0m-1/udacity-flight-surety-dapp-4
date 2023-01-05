import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.flights = [];
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {

            if (error) {
                console.error(error);
                return;
            }

            this.owner = accts[0];

            const airlineData = [
                {code: 'JAL', name: 'Japan Airlines'},
                {code: 'KLM', name: 'KLM'},
                {code: 'EZS', name: 'easyJet'},
                {code: 'EK', name: 'Emirates'},
                {code: 'AY', name: 'Finnair'},
            ];

            // keep 0 for owner
            for (let i = 1; i < 6; i++) {

                this.airlines.push({
                    address: accts[i],
                    code: airlineData[i - 1].code,
                    name: airlineData[i - 1].name,
                });

                // add 1 flight per airline
                this.flights.push({
                    airline: accts[i],
                    flight: `${airlineData[i - 1].code}${i}`,
                    timestamp: new Date(Date.now() - 100000)
                });
            }

            callback();
        });
    }

    isOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isOperational()
            .call({from: self.owner}, callback);
    }

    fetchFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0].address,
            flight: flight,
            timestamp: Math.floor(Date.now() / 1000)
        }
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }

    buyInsurance(airline, flight, timestamp, amount, callback) {
        let self = this;

        self.flightSuretyApp.methods
            .buy(airline, flight, timestamp)
            .send({from: self.owner, value: amount}, (error, result) => {
                if (error) {
                    console.error(error);
                    return;
                }
                callback(error, payload);
            });
    }
}