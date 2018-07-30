Octave Online Server
====================

This repository contains the full stack of code to run Octave Online Server, the infrastructure that powers [Octave Online](https://octave-online.net).

## High-Level Overview

There are three separate components of Octave Online Server:

1. **Client**: Code that runs in the browser.
2. **Front Server**: Authentication, client session handling.
3. **Back Server**: File I/O, Octave process handling.

*Communication:* The Client and Front Server communicate primarilly with WebSockets via [socket.io](https://socket.io); the Front Server and Back Server communicate primarilly with [Redis PubSub](https://redis.io/topics/pubsub).  User account information is stored in [MongoDB](https://www.mongodb.com) and is accessed primarilly from the Front Server.  User files are stored in [Git on the Server](https://git-scm.com/book/en/v1/Git-on-the-Server) and are accessed primarilly from the Back Server.

*Scaling:* Front Servers and Back Servers can be scaled independently (in general, you need more Back Servers than Front Servers).  It is also possible to run both the Front Server and the Back Server on the same computer.

*Languages:* All code is written with JavaScript technologies, although for historical reasons, the three components use different flavors of JavaScript.  The Client uses ES5; the Front Server uses TypeScript; and the Back Server uses ES6.

## Installation

*Note:* Octave Online Server has a lot of moving parts.  It is recommend that you feel comfortable with basic system administration before attempting an installation.

### Prerequisites

[Required] *Operating System:* Octave Online Server is built and tested exclusively on GNU/Linux.  It is recommended that you use CentOS 7, although other modern distributions should work also.

[Required] *Node.js:* Octave Online Server is built and tested with Node.js LTS version 6.  I recommend configuring the installation from a [Package Manager](https://nodejs.org/en/download/package-manager/#enterprise-linux-and-fedora).

	# Install Node.js 6.x LTS on CentOS 7:
	$ curl --silent --location https://rpm.nodesource.com/setup_6.x | sudo bash -
	$ sudo yum makecache
	$ sudo yum install nodejs

[Required] *Redis:* Install and run a local Redis instance.  Enable expiration events in redis.conf:

	$ sudo yum install redis
	$ sudo emacs redis.conf
	# Search for "notify-keyspace-events"
	# Set the value to "Ex"

Although it is possible to use a third-party hosted Redis instance, this is not recommended because Redis latency is amplified due to its central role in the Octave Online Server architecture.

[Recommended] *MongoDB:* Install and run a MongoDB instance.  Unlike Redis, MongoDB is not as central of a piece in the infrastructure, so it is possible to use a remotely hosted MongoDB if you do not want to host it locally.  My experience is that it takes some time to correctly configure a fast and secure MongoDB installation.  Keep in mind that MongoDB will contain personally identifiable information for user accounts.

[Recommended] *Mailgun:* If you want Octave Online Server to be able to send emails, such as for email-based login, you need a [Mailgun](https://www.mailgun.com) account.  The free tier should cover most experimental and low-traffic usage.

[Optional] *Google Analytics:* For aggregated statistics about traffic to your site, you can enable [Google Analytics](https://www.google.com/analytics/) integration.

[Optional] *Nginx:* For better performance with serving static files and easier HTTPS setup, I recommend installing and configuring [Nginx](https://www.nginx.com).  However, this is not an essential piece, and it can be done after the rest of the infrastructure is up and running.

### Configuration File

Read `config_defaults.hjson` to learn more about the array of settings available for Octave Online Server.  When ready, copy `config.sample.hjson` into `config.hjson`, and fill in the required details.  Your own `config.hjson` is ignored by source control.

### Installing Depencencies and Building

In each of the five directories containing Node.js projects, go in and run `npm install`:

	$ (cd shared && npm install)
	$ (cd back-filesystem && npm install)
	$ (cd back-master && npm install)
	$ (cd front && npm install)
	$ (cd client && npm install)

Link the shared project into all of the others; this allows all projects to use the code in the shared directory:

	$ (cd shared && npm link)  # might require sudo on npm link
	$ (cd back-filesystem && npm link @oo/shared)
	$ (cd back-master && npm link @oo/shared)
	$ (cd front && npm link @oo/shared)
	$ (cd client && npm link @oo/shared)

You also need to install the Bower (client-side) dependencies for the client project:

	$ (cd client && npm run bower install)

Finally, build the client and front server projects (the back server runs without needing to be built):

	$ (cd client && npm run grunt)
	$ (cd front && npm run grunt)

### Running Octave Online Server

To run the code manually, just open up two terminals and run each of the following two commands:

	$ (cd back-master && DEBUG=* node app.js)
	$ (cd front && node app.js)

To run the code as a service, you can install the systemd service provided in this repository and enable the code to be automatically run at startup.
