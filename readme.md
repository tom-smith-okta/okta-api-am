# Okta API Access Management Demo

This demo is meant to be a test harness to show how Okta can serve as an external OAuth authorization server for many leading API gateways. As of September 2019, the demo includes:

- Amazon API Gateway
- Apigee
- Kong
- Mulesoft

In order for this demo to work, you must first set up Okta and set up your API Gateway using the instructions in the [Okta API Center](https://github.com/tom-smith-okta/okta-api-center).

The public version of this demo is [here](https://okta-api-am.herokuapp.com/).

## Prerequisites

To run this app, you will need the following:

- Node.js
- The proxy uri of your gateway
- Your Okta tenant name
- The issuer value of your Okta authorization server
- An Okta client_id and client_secret

You should have all of these values available after setting up Okta and your API Gateway using the Okta API Center.

## Setup

- Install the node dependencies:
`npm install`

- Copy the file `.env_example` to a new file named `.env`

- Update the values in the `.env` file.

- In the `config.json` file:

-- update the values in the Okta object.

-- for your chosen api gateway, update the value of `proxy_uri`

## Run

To run the app:

`node app.js`