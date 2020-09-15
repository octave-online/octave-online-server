/*
 * Copyright © 2019, Octave Online LLC
 *
 * This file is part of Octave Online Server.
 *
 * Octave Online Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Octave Online Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Octave Online Server.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

"use strict";

const Compute = require("@google-cloud/compute");
const { Storage } = require("@google-cloud/storage");
const gcpMetadata = require("gcp-metadata");

const { config } = require("@oo/shared");

///// Compute /////

let _computeClient = null;

function getComputeClient() {
	if (!_computeClient) {
		if (config.gcp.credentials) {
			_computeClient = new Compute({
				projectId: config.gcp.credentials.project_id,
				credentials: config.gcp.credentials
			});
		} else {
			_computeClient = new Compute();
		}
	}
	return _computeClient;
}

async function getRecommendedSize(log) {
	const client = getComputeClient()
		.zone(config.gcp.zone)
		.autoscaler(config.gcp.instance_group_name);
	const [, result ] = await client.get();
	log("Recommended size:", result.recommendedSize);
	return result.recommendedSize;
}

async function getTargetSize(log) {
	const client = getComputeClient()
		.zone(config.gcp.zone)
		.instanceGroupManager(config.gcp.instance_group_name);
	const [, result ] = await client.get();
	log("Target size:", result.targetSize);
	return result.targetSize;
}

async function getAutoscalerInfo(log) {
	const [ recommendedSize, targetSize ] = await Promise.all([
		getRecommendedSize(log),
		getTargetSize(log)
	]);
	return {
		recommendedSize,
		targetSize
	};
}

async function getSelfName(log) {
	const name = await gcpMetadata.instance("name");
	log("Self name:", name);
	return name;
}

async function removeSelfFromGroup(log) {
	const selfName = await getSelfName(log);
	const vm = getComputeClient()
		.zone(config.gcp.zone)
		.vm(selfName);
	const client = getComputeClient()
		.zone(config.gcp.zone)
		.instanceGroupManager(config.gcp.instance_group_name);

	let operation;
	if (config.gcp.instance_group_removal_method === "abandon") {
		log("Abandoning self");
		[ operation ] = await client.abandonInstances(vm);
	} else if (config.gcp.instance_group_removal_method === "delete") {
		log("Deleting self");
		[ operation ] = await client.deleteInstances(vm);
	} else {
		throw new Error("Unknown removal method");
	}
	return operation;
}

///// Storage /////

let _storageClient = null;

function getStorageClient() {
	if (!_storageClient) {
		if (config.gcp.credentials) {
			_storageClient = new Storage({
				projectId: config.gcp.credentials.project_id,
				credentials: config.gcp.credentials
			});
		} else {
			_storageClient = new Storage();
		}
	}
	return _storageClient;
}

async function downloadFile(log, bucketName, srcPath, destination) {
	const client = getStorageClient()
		.bucket(bucketName);
	await client.file(srcPath).download({ destination });
	log(`gs://${bucketName}/${srcPath} downloaded to ${destination}.`);
}


module.exports = {
	getAutoscalerInfo,
	removeSelfFromGroup,
	downloadFile
};
