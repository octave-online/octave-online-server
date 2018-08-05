Octave Online Server: Front Server
==================================

This repository contains the code for the Octave Online Server front server.

This code should be run on the same host where the *client* project is set up, but not necesarilly the same host as the back server projects.

## Installation

Start by cloning this repository and making it your working directory.

Download the TypeScript type definitions:

	git submodule update --init

Now compile the server:

	npm run grunt
