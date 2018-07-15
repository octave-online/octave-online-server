Octave Online Server: Front Server
==================================

This repository contains the code for the Socket.IO server.

## Installation

Start by cloning this repository and making it your working directory.

Download the TypeScript type definitions:

	git submodule update --init

Make sure you've installed the following dependency:

	npm install -g grunt-cli

Now compile the server:

	grunt

## Redis and MongoDB

In order to use Octave Online, you will need to have a working [Redis](http://redis.io/) and [MongoDB](http://www.mongodb.org/) installation.  You can install these from yum, apt-get, etc.  For example, a simple `apt-get install redis-server` and `apt-get install mongodb` should be sufficient.

## Configuration

You will need to make a JSON configuration file at the following location: *config/app.json*

This file contains the configuration options for your local install of Octave Online.  The specification for the configuration file can be found in *src/config.ts*.  Here is an example *app.json*.

	{
		"front": {
			"protocol": "http",
			"hostname": "localhost",
			"port": 8080,
			"listen_port": 8080,
			"static_path": "../oo-client/app",
			"cookie": {
				"name": "oo.sid",
				"secret": "xxxxxxxx",
				"max_age": 7889231400
			}
		},
		"mongodb": {
			"hostname": "localhost",
			"db": "oo"
		},
		"google": {
			"oauth_key": "xxxxxxxxx.apps.googleusercontent.com",
			"oauth_secret": "xxxxxxxx"
		},
		"redis": {
			"hostname": "localhost",
			"port": 6379,
			"options": {
				"auth_pass": "xxxxxxxx"
			},
			"expire": {
				"interval": 5,
				"timeout": 16
			}
		},
		"ot": {
			"operation_expire": 120,
			"stats_interval": 60,
			"document_expire": {
				"interval": 120,
				"timeout": 86400
			}
		}
	}

The following options need to be customized.

 - Put the path to your Octave Online Client local clone in the "path" option under "static".  You can point it to either "app" or to "dist" depending on whether you want to use the uncompiled or compiled version of Octave Online Client.
 - Make a directory on your server where to store your user's script files.  The directory should be fully readable and writeable by the user running the Octave Online server.  Put the path in the "path" option under "git".
 - Put some random character string in "secret" under "cookie".  This is what prevents man-in-the-middle attacks and session hijacking.
 - If you want to support Google OAuth logins, customize the "google" section.  You can ignore this section if you don't want to support Google logins.
 - If you have a password on your Redis server, put the password in the "auth_pass" option.  You can ignore this if you don't have a password set up on your Redis server.
 - The *ot.expire* values defines how long, in seconds, operations are kept in the cache after a user makes a change in a collaborative field.  For slow internet connections, or if you are getting errors that say "Operation history is too shallow", higher values here may be desirable.

## License

Copyright (c) 2015 Shane Carr

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to use, copy, merge, and modify the Software, subject to the following conditions: The above copyright notice and this License shall be included in all copies or substantial portions of the Software.

Persons obtaining a copy of the Software may not publish, distribute, sublicense, and/or sell the Software or substantial portions of the Software under the terms of this License.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
