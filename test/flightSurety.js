var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;

    const foundingEth = web3.utils.toWei('10', "ether")

    let airline1;
    let airline2 = accounts[2];
    let airline3 = accounts[3];
    let airline4 = accounts[4];
    let airline5 = accounts[5];
    let airline6 = accounts[6];
    let airline7 = accounts[7];

    let passenger1 = accounts[10];
    let passenger2 = accounts[11];
    let passenger3 = accounts[12];

    const TEST_ORACLES_COUNT = 20;

    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;

    const flight1 = '731';
    const flight2 = '732';

    const flightTime1 = Date.parse('2023-01-01:00:00:00:000Z');
    const flightTime2 = Date.parse('2023-01-02:00:00:00:000Z');

    before('setup contract', async () => {
        config = await Test.Scope(accounts);
        airline1 = config.firstAirline;

        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/

    it(`(multiparty) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");

    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, {from: config.testAddresses[2]});
        } catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false);
        } catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try {
            await config.flightSurety.setTestingMode(true);
        } catch (e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);

    });

    it('(airline) first airline is registered when contract is deployed.', async () => {

        let result = await config.flightSuretyData.isAirline.call(config.firstAirline);

        assert.equal(result, true, "first airline should be registered.");
    });

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {

        try {
            await config.flightSuretyApp.registerAirline.call(airline2, {from: config.firstAirline});
        } catch (e) {

        }

        let result = await config.flightSuretyData.isAirline.call(airline2);

        assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");
    });

    it('(airline) becomes funded with 10 ether', async () => {
        let beforeFunding = await config.flightSuretyData.getFund(config.firstAirline);

        assert.equal(beforeFunding, 0, "isAirline must be false when airline funding < 10 ether");

        await config.flightSuretyData.sendTransaction({from: config.firstAirline, value: foundingEth});

        const afterFunding = await config.flightSuretyData.getFund(config.firstAirline);

        assert.equal(afterFunding, web3.utils.toWei('10', "ether"), "isAirline must be true when airline funding < 10 ether");
    });

    it('(airline) 1st Airline can register a 2nd Airline using registerAirline() if it is funded', async () => {

        await config.flightSuretyData.sendTransaction({from: config.firstAirline, value: foundingEth});

        await config.flightSuretyApp.registerAirline(airline2, {from: config.firstAirline});

        let result = await config.flightSuretyData.isAirline.call(airline2);

        assert.equal(result, true, "Airline should be able to register another airline if enough funding");
    });

    it('(airline) 2nd Airline can register 3rd & 4th Airline using registerAirline() if it is funded', async () => {

        await config.flightSuretyData.sendTransaction({from: airline2, value: foundingEth});

        await config.flightSuretyApp.registerAirline(airline3, {from: airline2});
        await config.flightSuretyApp.registerAirline(airline4, {from: airline2});

        assert.equal(
            await config.flightSuretyData.isAirline.call(airline3),
            true,
            "Airline should not be able to register another airline if it hasn't provided funding"
        );

        assert.equal(
            await config.flightSuretyData.isAirline.call(airline4),
            true,
            "Airline should not be able to register another airline if it hasn't provided funding"
        );

        assert.equal(
            await config.flightSuretyData.getRegisteredAirlineCount(),
            4,
            "RegisteredAirlineCount should be 4"
        );
    });

    it('(airline) 5th Airline is registered when consensus is reached with 2/4 votes', async () => {

        await config.flightSuretyData.sendTransaction({from: airline3, value: foundingEth});
        await config.flightSuretyData.sendTransaction({from: airline4, value: foundingEth});

        assert.equal(
            await config.flightSuretyData.isAirline.call(airline5),
            false,
            "5th Airline should not be registered with 0/4 votes"
        );

        await config.flightSuretyApp.registerAirline(airline5, {from: airline2});

        assert.equal(
            await config.flightSuretyData.isAirline.call(airline5),
            false,
            "5th Airline should not be registered with 1/4 votes"
        );

        await config.flightSuretyApp.registerAirline(airline5, {from: airline3});

        assert.equal(
            await config.flightSuretyData.isAirline.call(airline5),
            true,
            "Airline 5th should be registered with 2/4 votes"
        );
    });

    it('(airline) 6th Airline is registered when consensus is reached with 3/5 votes', async () => {

        await config.flightSuretyData.sendTransaction({from: airline5, value: foundingEth});

        // =============================================================================================================

        await config.flightSuretyApp.registerAirline(airline6, {from: airline1});

        assert.equal(
            await config.flightSuretyData.isAirline.call(airline6),
            false,
            "6th Airline should not be registered with 1/5 votes"
        );

        // =============================================================================================================

        await config.flightSuretyApp.registerAirline(airline6, {from: airline2});

        assert.equal(
            await config.flightSuretyData.isAirline.call(airline6),
            false,
            "6th Airline should not be registered with 2/5 votes"
        );

        // =============================================================================================================

        await config.flightSuretyApp.registerAirline(airline6, {from: airline3});

        assert.equal(
            await config.flightSuretyData.isAirline.call(airline6),
            true,
            "6th Airline should be registered with 3/5 votes"
        );

    });

    it('(airline) Airline cannot vote multiple times for the same airline', async () => {

        await config.flightSuretyApp.registerAirline(airline7, {from: airline1});

        try {
            await config.flightSuretyApp.registerAirline(airline7, {from: airline1});
            assert.equal(false, "should fail to registerAirline multiple times for the same airline")
        } catch (e) {
            // expected
        }

    });

    it('(Oracles) can register oracles', async () => {

        let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

        for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
            //console.log('register oracle' + a);
            await config.flightSuretyApp.registerOracle({from: accounts[a], value: fee, gas: '4500000'});
            // console.log('oracle registered' + a);
        }
    });

    it('(airline) 1st Airline can register flight(1)', async () => {

        await config.flightSuretyApp.registerFlight(config.firstAirline, flight1, flightTime1, {
            from: config.firstAirline,
            gas: '4500000'
        });

        let status = await config.flightSuretyApp.getFlightStatus(config.firstAirline, flight1, flightTime1, {from: config.firstAirline});

        assert.equal(status, STATUS_CODE_UNKNOWN, "status should be 0 (unkwown)")
    });

    it('(Passengers) may pay up to 1 ether for purchasing flight insurance (flight1)', async () => {

        let noInsurance = await config.flightSuretyData.getPremiums(passenger1, config.firstAirline, flight1, flightTime1);

        assert.equal(noInsurance, web3.utils.toWei('0', 'ether'), "passenger 1 didn't pay insurance for flight 1");

        await config.flightSuretyApp.buy(config.firstAirline, flight1, flightTime1, {
            from: passenger1, value: web3.utils.toWei('1', 'ether')
        });

        let insurance = await config.flightSuretyData.getPremiums(passenger1, config.firstAirline, flight1, flightTime1);

        assert.equal(insurance, web3.utils.toWei('1', 'ether'), "passenger 1 paid 1 ETH insurance for flight 1")
    });

    it('(Oracles) can update status to ON_TIME (flight1)', async () => {

        await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight1, flightTime1);

        for (let a = 1; a < TEST_ORACLES_COUNT; a++) {

            let oracleIndexes = await config.flightSuretyApp.getMyIndexes({from: accounts[a]});

            for (let idx = 0; idx < 3; idx++) {

                try {
                    await config.flightSuretyApp
                        .submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight1, flightTime1, STATUS_CODE_ON_TIME, {
                            from: accounts[a],
                            gas: '4500000'
                        });

                    let flightStatus = await config.flightSuretyApp.getFlightStatus(config.firstAirline, flight1, flightTime1, {from: config.firstAirline});
                    //console.log('\n Post', idx, oracleIndexes[idx].toNumber(), flight1, flightTime1, flightStatus);
                } catch (e) {
                    //console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight1, flightTime1);
                }
            }
        }

        let flightStatusUpdated = await config.flightSuretyApp.getFlightStatus(config.firstAirline, flight1, flightTime1, {from: config.firstAirline});

        assert.equal(flightStatusUpdated, STATUS_CODE_ON_TIME, "status should be 10 (ON_TIME)")

    });

    it('(Passenger) should not receive payout for ON_TIME (flight1)', async () => {

        let passenger1Credit = await config.flightSuretyData.getCredit(passenger1, {from: config.flightSuretyApp.address});

        assert.equal(passenger1Credit, 0, "no credit payout for flight ON_TIME")

    });

    it('(airline) 2nd Airline can register flight 2', async () => {

        await config.flightSuretyApp.registerFlight(airline2, flight2, flightTime2, {
            from: airline2,
            gas: '4500000'
        });

        let status = await config.flightSuretyApp.getFlightStatus(airline2, flight2, flightTime2, {from: airline2});

        assert.equal(status, STATUS_CODE_UNKNOWN, "status should be 0 (unkwown)")
    });

    it('(Passengers) may pay up to 1 ether for purchasing flight insurance (flight2)', async () => {

        await config.flightSuretyApp.buy(airline2, flight2, flightTime2, {
            from: passenger1, gas: '4500000', value: web3.utils.toWei('1', 'ether')
        });

        await config.flightSuretyApp.buy(airline2, flight2, flightTime2, {
            from: passenger2, gas: '4500000', value: web3.utils.toWei('0.5', 'ether')
        });

        await config.flightSuretyApp.buy(airline2, flight2, flightTime2, {
            from: passenger3, gas: '4500000', value: web3.utils.toWei('0.1', 'ether')
        });

        let insuranceP1 = await config.flightSuretyData.getPremiums(passenger1, airline2, flight2, flightTime2);
        let insuranceP2 = await config.flightSuretyData.getPremiums(passenger2, airline2, flight2, flightTime2);
        let insuranceP3 = await config.flightSuretyData.getPremiums(passenger3, airline2, flight2, flightTime2);

        assert.equal(insuranceP1, web3.utils.toWei('1.0', 'ether'), "passenger 1 paid 1.0 ETH insurance for flight 2");
        assert.equal(insuranceP2, web3.utils.toWei('0.5', 'ether'), "passenger 2 paid 0.5 ETH insurance for flight 2");
        assert.equal(insuranceP3, web3.utils.toWei('0.1', 'ether'), "passenger 3 paid 0.1 ETH insurance for flight 2");
    });

    it('(Oracles) can update status to LATE_AIRLINE (flight2)', async () => {

        await config.flightSuretyApp.fetchFlightStatus(airline2, flight2, flightTime2);

        for (let a = 1; a < TEST_ORACLES_COUNT; a++) {

            let oracleIndexes = await config.flightSuretyApp.getMyIndexes({from: accounts[a]});

            for (let idx = 0; idx < 3; idx++) {

                try {
                    await config.flightSuretyApp
                        .submitOracleResponse(oracleIndexes[idx], airline2, flight2, flightTime2, STATUS_CODE_LATE_AIRLINE, {
                            from: accounts[a],
                            gas: '4500000'
                        });

                    let flightStatus = await config.flightSuretyApp.getFlightStatus(airline2, flight2, flightTime2, {from: airline2});
                    //console.log('\n Post', idx, oracleIndexes[idx].toNumber(), flight1, flightTime1, flightStatus);
                } catch (e) {
                    //console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight1, flightTime1);
                }
            }
        }

        let flightStatusUpdated = await config.flightSuretyApp.getFlightStatus(airline2, flight2, flightTime2, {from: airline2});

        assert.equal(flightStatusUpdated, STATUS_CODE_LATE_AIRLINE, "status should be 20 (LATE_AIRLINE)")
    });

    it('(Passenger) should receive payout for LATE_AIRLINE (flight2)', async () => {

        let passenger1Credit = await config.flightSuretyData.getCredit(passenger1, {from: config.flightSuretyApp.address});
        let passenger2Credit = await config.flightSuretyData.getCredit(passenger2, {from: config.flightSuretyApp.address});
        let passenger3Credit = await config.flightSuretyData.getCredit(passenger3, {from: config.flightSuretyApp.address});

        assert.equal(passenger1Credit, web3.utils.toWei('1.50', "ether"), "Expect credit payout for flight(2) LATE_AIRLINE")
        assert.equal(passenger2Credit, web3.utils.toWei('0.75', "ether"), "Expect credit payout for flight(2) LATE_AIRLINE")
        assert.equal(passenger3Credit, web3.utils.toWei('0.15', "ether"), "Expect credit payout for flight(2) LATE_AIRLINE")
    });
});