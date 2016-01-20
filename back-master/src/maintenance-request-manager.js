"use strict";

const uuid = require("uuid");
const EventEmitter = require("events");
const log = require("@oo/shared").logger("maint-req-manager");
const config = require("@oo/shared").config;

class MaintenanceReuestManager extends EventEmitter {
	constructor() {
		super();
		this.reset();
	}

	reset() {
		this._priority = 0;
		this._responses = {};
	}

	beginRequestingMaintenance() {
		log.info("Beginning maintenance requests");
		this.reset();
		this._requestInterval = setInterval(this._requestMaintenance.bind(this), config.maintenance.requestInterval);
	}

	onMessage(id, isRequest, message) {
		let isOwnRequest = Object.keys(this._responses).indexOf(id) !== -1;

		if (isRequest && !isOwnRequest) {
			// Reply to the maintenance request.  Reply "yes" only if the requester's priority is higher than our own priority.
			let response = (message.priority > this._priority);
			this.emit("reply-to-maintenance-request", id, response);
			log.trace("Replying to maintenance request:", id, message.priority, this._priority);
		} else if (!isRequest && isOwnRequest) {
			// Someone replied to our own maintenance request.
			this._responses[id].push(message.response);
			log.trace("Received reply to maintenance request:", id, message.response);
		}
	}

	stop() {
		if (this._requestInterval) clearInterval(this._requestInterval);
	}

	_requestMaintenance() {
		let id = uuid.v4();
		this._priority += 1;
		this._responses[id] = [];
		this.emit("request-maintenance", id, this._priority);
		log.trace("Sent maintenance request:", id, this._priority);

		setTimeout(() => {
			// Count the number of yeses and nos.  If there are more yeses than nos, return a success.
			let numYes = this._responses[id].reduce((s,v) => {
				return s + (v ? 1 : 0);
			}, 0);
			let numNo = this._responses[id].length - numYes;
			let success = numYes > numNo;

			// Were we successful?
			if (success) {
				log.info("Maintenance request was approved");
				this.emit("maintenance-accepted");
				this._priority = Number.MAX_VALUE;
				clearInterval(this._requestInterval);
			}
			else {
				log.trace("Maintenance request failed; trying again:", id);
			}

			// Dereference responses array
			delete this._responses[id];
		}, config.maintenance.responseWaitTime);
	}
}

module.exports = MaintenanceReuestManager;
