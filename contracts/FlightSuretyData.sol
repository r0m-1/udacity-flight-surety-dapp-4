// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    mapping(address => bool) authorizations;

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    /***********************************************/
    /* Airlines                                    */
    /***********************************************/

    struct Airline {
        bool registered;
        uint balance;
    }

    mapping(address => Airline) airlines;

    uint registeredAirlineCount;

    /***********************************************/
    /* Flights                                     */
    /***********************************************/

    mapping (bytes32 => bool) flights; // flights by key

    mapping (bytes32 => mapping (address => uint)) insurances; // flightKey => passenger => purchase amount
    mapping (bytes32 => address[]) passengers; // // flightKey => passengers[]

    mapping (address => uint) insurancePayouts; // passenger => payout amount

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
    (
        address firstAirline
    )
    {
        contractOwner = msg.sender;
        airlines[firstAirline] = Airline({registered : true, balance : 0});
        registeredAirlineCount = 1;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational()
    {
        require(operational, "Contract is currently not operational");
        _;
        // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireAuthorizedCaller()
    {
        require(authorizations[msg.sender], "Caller is not authorized");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function getRegisteredAirlineCount()
    public
    view
    returns (uint)
    {
        return registeredAirlineCount;
    }

    function getFund(address _airline)
    public
    view
    returns (uint)
    {
        return airlines[_airline].balance;
    }

    function isAirline(address _airline)
    public
    view
    returns (bool)
    {
        return airlines[_airline].registered;
    }

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational()
    public
    view
    returns (bool)
    {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus
    (
        bool mode
    )
    external
    requireContractOwner
    {
        operational = mode;
    }

    function authorizeCaller(address caller) external requireContractOwner {
        authorizations[caller] = true;
    }

    function deauthorizeCaller(address caller) external requireContractOwner {
        authorizations[caller] = false;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline
    (
        address _airline
    )
    requireIsOperational()
    requireAuthorizedCaller()
    external
    {
        airlines[_airline] = Airline({registered : true, balance : 0});
        registeredAirlineCount = registeredAirlineCount.add(1);
    }


    // returns premium paid by the passenger
    function getPremiums(
        address passenger,
        address airline,
        string memory flight,
        uint256 timestamp
    )
    requireIsOperational()
    public
    view
    returns (uint) {

        bytes32 key = getFlightKey(airline, flight, timestamp);

        return insurances[key][passenger];
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy
    (
        address passenger,
        address airline,
        string memory flight,
        uint256 timestamp
    )
    requireIsOperational()
    requireAuthorizedCaller()
    external payable {

        bytes32 key = getFlightKey(airline, flight, timestamp);

        require(insurances[key][passenger] == 0, 'passenger can buy only insurance once.');

        insurances[key][passenger] = msg.value;
        passengers[key].push(passenger);
    }

    /*
        return the amount of credit owned by a passenger
    */
    function getCredit
    (
        address passenger
    )
    requireIsOperational()
    external view returns (uint) {
        return insurancePayouts[passenger];
    }

    /**
     *  @dev Credits payouts to passengers who bought an insurance for a given flight.
     */
    function creditInsurees
    (
        address airline,
        string memory flight,
        uint256 timestamp,
        uint payoutPercentage
    )
    requireAuthorizedCaller()
    requireIsOperational()
    external
    {
        bytes32 key = getFlightKey(airline, flight, timestamp);

        address[] memory flightPassengers = passengers[key];

        // all passengers with insurance on this flight will receive payout credit.
        for (uint i = 0; i < flightPassengers.length; i++) {
            address passenger = flightPassengers[i];
            uint credit = insurancePayouts[passenger];
            insurancePayouts[passenger] = credit.add(insurances[key][passenger].mul(payoutPercentage).div(100));
            delete insurances[key][passenger];
        }
        delete passengers[key];
    }


    /**
     *  @dev Transfers eligible payout funds to passengers who bought an insurance for a given flight
     *
     */
    function pay
    (
    )
    requireIsOperational()
    // TODO requireAuthorizedCaller()
    external
    {
        address payable passenger = payable(msg.sender);

        require(insurancePayouts[passenger] > 0, 'Passenger has no credit.');
        uint credit = insurancePayouts[passenger];
        insurancePayouts[passenger] = 0;
        passenger.transfer(credit);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund()
    requireIsOperational()
    public payable
    {
        airlines[msg.sender].balance = airlines[msg.sender].balance.add(msg.value);
    }

    function getFlightKey
    (
        address airline,
        string memory flight,
        uint256 timestamp
    )
    pure
    internal
    returns (bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function registerFlight(
        address airline,
        string memory flight,
        uint256 timestamp
    )
    requireIsOperational()
    requireAuthorizedCaller()
    external {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        flights[key] = true;
    }

    function isFlight(
        address airline,
        string memory flight,
        uint256 timestamp
    )
    requireIsOperational()
    requireAuthorizedCaller()
    public view returns (bool) {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        return flights[key];
    }


    receive() external payable {
        fund();
    }
}