var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;

    const foundingEth = web3.utils.toWei('10', "ether")

    let airline2 = accounts[2];
    let airline3 = accounts[3];
    let airline4 = accounts[4];

    before('setup contract', async () => {
        config = await Test.Scope(accounts);
        // FIXME await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
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
    });
});