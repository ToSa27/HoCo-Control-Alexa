const EventEmitter = require('events');
const util = require('util');
const log = require("./log.js");
const Mqtt = require('mqtt');

function Bus(config) {
	log.debug('bus construct');
	EventEmitter.call(this);
	var self = this;
	this.connected = false;
	this.config = config;
        this.prefix = this.config.prefix;
	this.mqtt = Mqtt.connect(this.config.url, {
		clientId: "hoco_alexa",
		username: self.config.username,
		password: self.config.password,
		will: {
			topic: self.prefix + "/@status",
			payload: JSON.stringify({
				val: "offline",
				data: {}
			}),
			qos: 0,
			retain: false
		}
	});
	
	this.mqtt.on('connect', function () {
		log.debug('bus connect');
		self.connected = true;
		self.send("@status", "online", {}, 0, false);
		self.emit("connected", self);
	});

	this.mqtt.on('reconnect', function() {
		log.debug('bus reconnect');
		self.connected = false;
		self.emit("disconnected", self);
	});

	this.mqtt.on('close', function() {
		log.debug('bus close');
		self.connected = false;
		self.emit("disconnected", self);
	});

	this.mqtt.on('offline', function() {
		log.debug('bus offline');
		self.connected = false;
		self.emit("disconnected", self);
	});

	this.mqtt.on('error', function(err) {
		log.err('bus error: ' + JSON.stringify(err));
		self.connected = false;
		self.emit("error", self, err);
	});

	this.mqtt.on('packetsend', function(packet) {
		//log.debug("bus packetsend: " + JSON.stringify(packet));
	});

	this.mqtt.on('packetreceive', function(packet) {
		//log.debug("bus packetreceive: " + JSON.stringify(packet));
	});

	this.mqtt.on('message', function (topic, message, packet) {
		//log.debug("bus message: " + topic + " = " + message);
	});
};

util.inherits(Bus, EventEmitter)

Bus.prototype.connected = function() {
        return this.connected;
};

Bus.prototype.send = function(topic, value, data, qos = 0, retain = true) {
	if (this.connected) {
		this.mqtt.publish(this.prefix + "/" + topic, JSON.stringify({
			val: value,
			data: data
		}), { qos: qos, retain: retain });
	};
};

module.exports = Bus;
