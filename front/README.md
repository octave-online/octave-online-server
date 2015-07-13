Octave Online Front
===================

This repository contains the code for the Socket.IO server.

## Installation

Start by cloning this repository and making it your working directory.

Download the TypeScript type definitions:

	git submodule update --init

Make sure you've installed the following dependency:

	npm install -g grunt-cli

Now compile the server:

	grunt

### Redis Heartbeats

If you would like the server to send periodic heartbeats to the Redis server, just install `redis-heartbeat` in npm.  This does not work in Windows, which is why it is optional.

	npm install redis-heartbeat

## Redis and MongoDB

In order to use Octave Online, you will need to have a working [Redis](http://redis.io/) and [MongoDB](http://www.mongodb.org/) installation.  You can install these from yum, apt-get, etc.  For example, a simple `apt-get install redis-server` and `apt-get install mongodb` should be sufficient.

## Configuration

You will need to make a JSON configuration file at the following location: *config/app.json*

This file contains the configuration options for your local install of Octave Online.  The specification for the configuration file can be found in *src/config.ts*.  Here is an example *app.json*.

	{
		"static": {
			"path": "../oo-client/app"
		},
		"mongodb": {
			"hostname": "localhost",
			"db": "oo"
		},
		"git": {
			"path": "/absolute/path/to/repos"
		},
		"url": {
			"protocol": "http",
			"hostname": "localhost",
			"port": 8080,
			"listen_port": 8080
		},
		"google": {
			"oauth_key": "xxxxxxxxx.apps.googleusercontent.com",
			"oauth_secret": "xxxxxxxx"
		},
		"cookie": {
			"name": "oo.sid",
			"secret": "xxxxxxxx",
			"max_age": 7889231400
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
			"expire": 10
		}
	}

The following options need to be customized.

 - Put the path to your Octave Online Client local clone in the "path" option under "static".  You can point it to either "app" or to "dist" depending on whether you want to use the uncompiled or compiled version of Octave Online Client.
 - Make a directory on your server where to store your user's script files.  The directory should be fully readable and writeable by the user running the Octave Online server.  Put the path in the "path" option under "git".
 - Put some random character string in "secret" under "cookie".  This is what prevents man-in-the-middle attacks and session hijacking.
 - If you want to support Google OAuth logins, customize the "google" section.  You can ignore this section if you don't want to support Google logins.
 - If you have a password on your Redis server, put the password in the "auth_pass" option.  You can ignore this if you don't have a password set up on your Redis server.
 - The *ot.expire* value defines how long, in seconds, operations are kept in the cache after a user makes a change in a collaborative field.  For slow internet connections, or if you are getting errors that say "Operation history is too shallow", a higher value here may be desirable.
