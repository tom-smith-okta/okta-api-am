
var bodyParser = require('body-parser');

var fs = require('fs');

var request = require('request');

var session = require("express-session");

//*******************************************/

var config_raw = fs.readFileSync('config.json')

var config = JSON.parse(config_raw)

console.dir(config)

const valid_routes = ['aws', 'apigee', 'kong', 'mulesoft']

//*******************************************/

module.exports = function (app) {

	app.get('/', function(req, res, next) {

		fs.readFile('./html/index.html', 'utf8', (error, page) => {

			if (error) { throw new Error(error) }

			fs.readFile('./html/gateway_list.html', 'utf8', (error, gateway_list) => {

				if (error) { throw new Error(error) }

				page = page.replace(/{{gateway_list}}/g, gateway_list)

				res.send(page);
			});
		});
	});

	app.get('/favicon.ico', function(req, res, next) {
		res.sendStatus(200);
	});

	app.get('/:gateway', function(req, res, next) {

		req.session.gateway = req.params.gateway

		if (!(valid_routes.includes(req.session.gateway))) {
			res.sendStatus(404)
		}
		else {
			get_page(req.params.gateway, function(err, webPage) {
				if (err) { throw new Error(err) }

				res.send(webPage)
			})
		}
	});

	app.post('/getAccessToken', function(req, res, next) {
		var code = req.body.code;

		console.log("the authorization code is: " + code);

		var url = config.okta.issuer + "/v1/token"

		var redirect_uri = get_redirect_uri(req.session.gateway)

		console.log("the url is: " + url);
		console.log("the redirect_uri is: " + redirect_uri);

		var options = {
			method: 'POST',
			url: url,
			qs: {
				grant_type: 'authorization_code',
				code: code,
				redirect_uri: redirect_uri
			},
			headers: {
				'cache-control': 'no-cache',
				authorization: 'Basic ' + get_basic_auth_string(req.session.gateway),
				'content-type': 'application/x-www-form-urlencoded'
			}
		};

		request(options, function (error, response, body) {
			if (error) throw new Error(error)

			console.log(body);

			var obj = JSON.parse(body);

			if (obj.hasOwnProperty("access_token")) {
				req.session.access_token = obj.access_token;
				console.log("the access token is: " + req.session.access_token);
			}
			if (obj.hasOwnProperty("id_token")) {
				req.session.id_token = obj.id_token;
			}

			// send the access token to the introspection endpoint
			// (for illustration purposes only)

			url = config.okta.issuer + "/v1/introspect"

			var options = {
				method: 'POST',
				url: url,
				qs: { token: req.session.access_token },
				headers: {
					'cache-control': 'no-cache',
					authorization: 'Basic ' + get_basic_auth_string(req.session.gateway),
					accept: 'application/json',
					'content-type': 'application/x-www-form-urlencoded'
				}
			};

			request(options, function (error, response, body) {
				if (error) throw new Error(error);

				console.log("response from Okta: ");
				console.log(body);

				var data = {
					access_token_introsp_response: body,
					access_token: req.session.access_token
				}

				res.json(data);
			});
		});
	});

	app.post('/getData', function(req, res, next) {

		var endpoint = req.body.endpoint;

		console.log("the requested endpoint is: " + endpoint)

		//*******************************************/

		var access_token = ""

		if (req.session.hasOwnProperty('access_token')) {
			access_token = req.session.access_token
		}
		else {
			access_token = "there is no access_token in the session"
		}

		console.log("the access token in the session is: " + access_token)

		//*******************************************/

		var gateway = req.session.gateway;

		console.log("the gateway is: \n" + gateway + "\n");

		//*******************************************/

		var url = config.gateways[gateway].proxy_uri + "/" + req.body.endpoint;

		console.log("the url is: " + url)

		//*******************************************/

		var options = {
			method: 'GET',
			url: url,
			headers: {
				'cache-control': 'no-cache',
				authorization: "Bearer " + req.session.access_token,
				accept: 'application/json',
				'content-type': 'application/x-www-form-urlencoded'
			}
		};

		request(options, function (error, response, body) {
			if (error) throw new Error(error)

			console.log("******\nresponse from API gateway: ")
			console.log("the status code is: " + response.statusCode)

			console.log("the body is:")
			console.log(body)

			if (response.statusCode == 403) {
				res.json({gateway_response: 'forbidden'})
				console.log("the request is forbidden")
			}
			else if (response.statusCode == 401) {
				res.json({ gateway_response: 'unauthorized' })
				console.log("the request is unauthorized")
			}
			else {
				res.json(body)
			}
		});
	});

	app.post('/killSession', function(req, res, next) {
		req.session.destroy(function(err) {
			if (err) {
				console.log("unable to destroy session.")
			}
			else {
				console.log("successfully destroyed session.");
			}
			res.send("OK");
		})
	});
}

//*******************************************/

function get_basic_auth_string() {

	var x = config.okta.client_id + ":" + process.env.OKTA_CLIENT_SECRET;

	var y = new Buffer(x).toString('base64');

	return y;
}

function get_links(gateway) {

	var links_html = ""

	var links = Object.keys(config.gateways[gateway].links)

	for (i = 0; i < links.length; i++) {
		var name = links[i]
		var href = config.gateways[gateway].links[name]
		links_html += "\n<li><a href ='" + href + "' target = '_blank'>" + name + "</a></li>"
	}

	return links_html
}

function get_page(gateway, callback) {

	var main_template = './html/main.html'
	var gateway_template = './html/' + gateway + '.html'
	var gateway_list = './html/gateway_list.html'

	fs.readFile(main_template, 'utf8', (error, page) => {

		if (error) { throw new Error(error) }

		fs.readFile(gateway_template, 'utf8', (error, gateway_content) => {

			if (error) { throw new Error(error) }

			fs.readFile('./html/gateway_list.html', 'utf8', (error, gateway_list) => {

				if (error) { throw new Error(error) }

				page = page.replace(/{{client_id}}/g, config.okta.client_id)
				page = page.replace(/{{display_name}}/g, config.gateways[gateway].display_name)
				page = page.replace(/{{gateway_list}}/g, gateway_list)
				page = page.replace(/{{okta_issuer}}/g, config.okta.issuer)
				page = page.replace(/{{okta_tenant}}/g, config.okta.tenant)
				page = page.replace(/{{gateway}}/g, gateway)
				page = page.replace(/{{gateway_content}}/g, gateway_content)
				page = page.replace(/{{gateway_links}}/g, get_links(gateway))
				page = page.replace(/password: /g, "password: " + process.env.USER_PASSWORD)
				page = page.replace(/{{proxy_uri}}/g, config.gateways[gateway].proxy_uri)
				page = page.replace(/{{redirect_uri}}/g, get_redirect_uri(gateway))
				page = page.replace(/{{title}}/g, get_title(gateway))
				page = page.replace(/{{integration_guide_href}}/g, config.gateways[gateway].links["Integration Guide"])

				return callback(null, page);

			});
		});
	});
}

function get_redirect_uri(gateway) {
	return process.env.REDIRECT_URI_BASE + "/" + gateway;
}

function get_title(gateway) {
	return "Okta API Access Management with " + config.gateways[gateway].display_name
}
