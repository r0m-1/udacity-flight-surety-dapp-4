import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async () => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error, result);

            contract.flights.forEach(flight => {
                let el = document.createElement("option");
                el.text = `${flight.flight} - ${new Date(flight.timestamp).toISOString()}`;
                el.value = JSON.stringify(flight);
                DOM.flightSelector.add(el);
            });

            DOM.elid('flight-number').value = (contract.flights[0].flight);

            display('Operational Status', 'Check if contract is operational', [{
                label: 'Operational Status',
                error: error,
                value: result
            }]);
        });


        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                display('Oracles', 'Trigger oracles', [{
                    label: 'Fetch Flight Status',
                    error: error,
                    value: result.flight + ' ' + result.timestamp
                }]);
            });
        })

        DOM.elid('flights-selector').addEventListener('change', () => {
            let selected = JSON.parse(DOM.flightSelector.value);

            DOM.elid('flight-number').value = (selected.flight);
        });

        DOM.elid('buy-insurance').addEventListener('click', () => {

            let selected = JSON.parse(DOM.flightSelector.value);

            let airline = selected.airline;
            let flight = selected.flight;
            let timestamp = Date.parse(selected.timestamp);

            let amount = DOM.elid('premium').value;

            // Write transaction
            contract.buyInsurance(airline, flight, timestamp, amount, (error, result) => {
                display('Passenger', 'buy insurance', [{
                    label: 'buy insurance',
                    error: error
                }]);
            });
        })

    });
})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className: 'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







