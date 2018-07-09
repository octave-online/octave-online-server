Octave Online Server: Back Server
=================================

This is the source code for the Octave Online back server.  In the future, the "front" and "client" will also be merged into this repo.

## Setup

There are two versions of the back server.  One uses Docker and is easier to set up and configure.  The other uses SELinux and is faster.

### Option 1: Docker Setup

Download and install [Docker](https://www.docker.com).

Run `make docker` from the project directory to build the required Docker images.  Building the images, especially the *docker-octave* image, will take time, so be patient.  You may want to let this step run overnight.

### Option 2: SELinux

Ensure that you are running on CentOS or another distribution of Linux that supports SELinux.  SELinux should come pre-installed on CentOS.

Make and build Octave from source.  Follow a procedure similar to the one put forth in *dockerfiles/build-octave.dockerfile*.

Run `sudo yum install -y selinux-policy-devel policycoreutils-sandbox selinux-policy-sandbox libcgroup-tools jq`

Run all of the following make commands from the projects directory.

- `sudo make install-cgroup`
- `sudo make install-selinux-policy`
- `sudo make install-selinux-bin`
- `sudo make install-site-m`

## Additional Setup

### Git SSH Key

If you use SSH to connect to the Git server containing people's saved files, you need to create a private key, save it at *back-filesystem/git/key.pem*, and export the variable `GIT_SSH=/path/to/back-filesystem/git/key.pem`.  You need to export that variable before you run `DEBUG=* node app.js` as described below.

### Config File

You need to create a file called *config.json* at *shared/config.json*.  Here is an example *config.json*.

	{
		"worker": {
			"token": "local",
			"clockInterval": {
				"min": 1500,
				"max": 2500
			},
			"maxSessions": 12,
			"uid": 1000,
			"logDir": "/srv/logs",
			"monitorLogs": {
				"subdir": "monitor"
			},
			"sessionLogs": {
				"subdir": "sessions_2018",
				"depth": 3
			}
		},
		"session": {
			"legalTime": {
				"guest": 5000,
				"user": 10000
			},
			"countdownExtraTime": 15000,
			"countdownRequestTime": 5000,
			"timewarnTime": 90000,
			"timeoutTime": 120000,
			"timewarnMessage": "NOTICE: Due to inactivity, your session will expire in five minutes.",
			"payloadLimit": {
				"guest": 5000,
				"user": 10000
			},
			"payloadMessageDelay": 100,
			"payloadAcknowledgeDelay": 5000,
			"urlreadPatterns": ["^example\\.com$", "^(.*\\.)?stanford\\.edu$", "^(.*\\.)?coursera\\.org$"],
			"textFileSizeLimit": 50000,
			"jsonMaxMessageLength": 1000000,
			"implementation": "docker"
		},
		"sessionManager": {
			"logInterval": 60000,
			"poolSize": 2,
			"poolInterval": 5000,
			"startupTimeLimit": 30000
		},
		"git": {
			"hostname": "localhost",
			"author": {
				"name": "Local User",
				"email": "localhost@localhost"
			},
			"helperUser": "git",
			"commitTimeLimit": 30000,
			"autoCommitInterval": 300000
		},
		"docker": {
			"cwd": "/home/oo",
			"gitdir": "/srv/git",
			"cpuShares": 512,
			"memoryShares": "256m",
			"diskQuotaKiB": 20480,
			"images": {
				"filesystemSuffix": "files",
				"octaveSuffix": "octave:prod"
			}
		},
		"maintenance": {
			"interval": 1800000,
			"requestInterval": 5000,
			"responseWaitTime": 3000,
			"pauseDuration": 15000,
			"maxNodesInMaintenance": 1
		},
		"redis": {
			"hostname": "localhost",
			"port": 6379,
			"options": {
				"auth_pass": "xyzxyzxyzxyzxyz"
			},
			"expire": {
				"interval": 5000,
				"timeout": 16000
			},
			"maxPayload": 10000
		},
		"mongo": {
			"hostname": "localhost",
			"port": 27019,
			"db": "oo"
		},
		"cgroup": {
			"name": "oo/octave",
			"cpuShares": 128,
			"cpuQuota": 800000,
			"uid": "oo",
			"gid": "oo"
		},
		"prlimit": {
			"addressSpace": 1000000000
		}
	}

A few settings to notice:

1. `.worker.logDir` needs to exist and be writable by the Octave Online process.
2. `.session.implementation` needs to be either "docker" or "selinux" depending on which version you decided to configure.
3. The settings in `.git` need to correspond to a working Git server.
4. The settings in `.redis` need to correspond to a working Redis server.

## Running the Back Server

Go to the *back-octave* directory and run `DEBUG=* node app.js` to start the back server.  The `DEBUG=*` is optional, but it gives you more details and can help with debugging problems.

## To-do list

- Update /usr/bin/sandbox according to https://github.com/SELinuxProject/selinux/commit/0f4620d6111838ce78bf5a591bb80c99c9d88730
- If using RHEL, the line "Defaults requiretty" must be commented out.

## License

Octave Online Server is licensed under the [GNU Affero General Public License](https://en.wikipedia.org/wiki/Affero_General_Public_License).

> Octave Online Server is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
>
> Octave Online Server is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details.

A copy of the license can be found in COPYING.

Note: You may contact webmaster@octave-online.net to inquire about other options for licensing Octave Online Server.
