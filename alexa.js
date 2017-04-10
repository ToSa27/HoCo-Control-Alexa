const fs = require('fs');
const express = require("express");
const http = require('http');
const https = require('https');
const bodyParser = require("body-parser");
const request = require('request');

const config = require("./config.js");
const log = require("./log.js");
const Bus = require("./bus.js");

var bus = new Bus(config.mqtt);
bus.on("connected", (thebus) => {
	log.debug("bus connected");
});

const devicesFile = __dirname + "/devices.json";
var devices = JSON.parse(fs.readFileSync(devicesFile));

var app = express();
var server;
if (config.web.ssl.enabled) {
	var certs = {
		key: fs.readFileSync(config.web.ssl.keyfile),
		cert: fs.readFileSync(config.web.ssl.certfile)
	};
	server = https.createServer(certs, app);
} else {
	server = http.createServer(app);
}

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.query());

function getAmazonProfile(token, cb) {
	var url = 'https://api.amazon.com/user/profile?access_token=' + token;
	request(url, function(error, response, body) {
		if (response.statusCode == 200)
			cb(JSON.parse(body));
		else
			cb(null);
	});
}

function checkAmazonOAuth(req, res, next) {
	var token = req.query.token;
        getAmazonProfile(token, function(profile) {
                if (profile) {
                        if (profile.email === config.api.amazonEmail) {
				next();
				return;
			}
		}
	        res.writeHead(403);
	        res.end('{}');
	});
}

app.get('/hoco/test', function(req, res, next) {
	res.end('hallo test');
});

app.get('/hoco/api', checkAmazonOAuth, function(req, res, next) {
	log.info('cmd: ' + req.query.cmd);
	switch (req.query.cmd) {
		case "DiscoverAppliancesRequest":
			var resp = { discoveredAppliances: JSON.parse(JSON.stringify(devices)) };
			for (var i = 0; i < resp.discoveredAppliances.length; i++)
				resp.discoveredAppliances[i].additionalApplianceDetails = {};
			res.end(JSON.stringify(resp));
			break;
		default:
			res.writeHead(404);
			res.end();
	};
});

app.get('/hoco/api/:applianceId', checkAmazonOAuth, function(req, res, next) {
        log.info('applianceId: ' + req.params.applianceId);
        log.info('cmd: ' + req.query.cmd);
	var device;
	for (var i = 0; i < devices.length; i++) {
		if (devices[i].applianceId === req.params.applianceId) {
			device = devices[i];
			break;
		}
	}
	if (!device) {
		res.writeHead(404);
                res.end();
		return;
	}
	var items = [];
	if (!Array.isArray(device.additionalApplianceDetails))
		items.push(device.additionalApplianceDetails);
	else
		items = device.additionalApplianceDetails;
        if (items.length == 0) {
                res.writeHead(404);
                res.end();
                return;
        }
        log.info('affecting ' + items.length + ' items');
	var skipres = false;
	for (var i = 0; i < items.length; i++) {
		log.info('item: ' + JSON.stringify(items[i]));
		if (items[i].set) {
			if (req.query.cmd in items[i].set) {
				var topic = items[i].adapter + "/" + items[i].node + "/" + items[i].parameter + "/$set";
				bus.send(topic, items[i].set[req.query.cmd], {}, 0, false);
				log.info('pub: ' + topic + ' = ' + items[i].set[req.query.cmd]);
			}
		}
		if (items[i].get) {
                        if (req.query.cmd in items[i].get) {
				skipres = true;
                                var topic = items[i].adapter + "/" + items[i].node + "/" + items[i].parameter + "/$get";
                                bus.send(topic, items[i].get[req.query.cmd], {}, 0, false);
                                log.info('pub: ' + topic + ' = ' + items[i].get[req.query.cmd]);
                        }			
		}
	}
	if (!skipres)
		res.end("{}");
});

app.get('/hoco/privacypolicy', function (req, res) {
	res.send('this is the hoco Privacy Policy URL placeholder');
});

app.get('/hoco/termsofuse', function (req, res) {
        res.send('this is the hoco Terms of Use URL placeholder');
});

server.listen(config.web.port);
log.info("Listening on port " + config.web.port);
