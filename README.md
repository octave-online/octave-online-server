Octave Online Server
====================

This repository contains the full stack of code to run Octave Online Server, the infrastructure that powers [Octave Online](https://octave-online.net).

[![Build Status](https://travis-ci.org/octave-online/octave-online-server.svg?branch=master)](https://travis-ci.org/octave-online/octave-online-server)

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

For more details on operating each of the three components, see the respective README files:

- [back-master/README.md](back-master/README.md) (back server)
- [front/README.md](front/README.md) (front server)
- [client/README.md](client/README.md) (client)

Every subdirectory of the top-level Octave Online Server directory has a README file that explains what the contents of the directory is for.

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

[Recommended] *Git Server:* In order to persist user files between sessions, you need to set up a Git file server.  It boils down to a server, which could be the current server, with a low-privilidged user usually named "git".  For more information, see [Git on the Server](https://git-scm.com/book/en/v1/Git-on-the-Server).  Also see [back-filesystem/README.md](back-filesystem/README.md) for instructions on how to configure a Git file server for Octave Online Server.

[Recommended] *MongoDB:* Install and run a MongoDB instance.  Unlike Redis, MongoDB is not as central of a piece in the infrastructure, so it is possible to use a remotely hosted MongoDB if you do not want to host it locally.  My experience is that it takes some time to correctly configure a fast and secure MongoDB installation.  Keep in mind that MongoDB will contain personally identifiable information for user accounts.

[Recommended] *Mailgun:* If you want Octave Online Server to be able to send emails, such as for email-based login, you need a [Mailgun](https://www.mailgun.com) account.  The free tier should cover most experimental and low-traffic usage.

[Recommended] *ReCAPTCHA:* Certain actions, such as when email is sent, require a CAPTCHA to prevent abuse. You should register for a [ReCAPTCHA](https://www.google.com/recaptcha/) v2 Checkbox and put your credentials into your config.hjson file.

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

### Configuring GNU Octave

Octave Online Server requires a special version of GNU Octave, which needs to be built.  *This is a required step.*  For more information, see [back-master/README.md](back-master/README.md).

### Running Octave Online Server

To run the code manually, just open up two terminals and run each of the following two commands:

	$ (cd back-master && DEBUG=* node app.js)
	$ (cd front && node app.js)

To run the code as a service, you can install the systemd service provided in this repository and enable the code to be automatically run at startup; see *entrypoint/oo.service* and `make install-selinux-bin`.

## Contributing

You are welcome to send pull requests for consideration for addition to Octave Online Server.  Pull requests are not guaranteed to be accepted; if in doubt, you should open an issue to discuss your idea before spending time writing your pull request.

### Style

If in doubt on style, follow the convention of the file you are editing.

**Wrapping and Indentation:** Use tab indentation, unless in a file format such as *.yml* that requires space indentation.  There is no limit on line length.  This gives you full control to configure your editor to your desired width and tab size.

**Naming:** In general, use camelCase for variable names and MACRO_CASE for constants.  Prefix private members with an underscore (`_`).

**Quotes:** Use double-quoted strings, unless you are in a context where you need a different quotation style, such as backtick strings in JavaScript.

**ECMAScript Versions:** JavaScript code in the *client* project should conform to the ECMAScript 5 standard, in order to have broad browser support.  JavaScript in all other projects can use the latest ECMAScript standard supported by Node.js 6.x LTS.  By design, all JavaScript code in Octave Online Server server should be able to be run natively without transcompilation to a different ECMAScript version.

### Linting

The *eslint* tool will catch most style and compatibility issues in JavaScript files.  Execute `npm run lint` in the top-level directory to check for errors.  If your code does not pass *eslint*, you will also trigger a Travis failure on GitHub.

### Manual Testing

Due to the complexity of Octave Online Server, there is not currently an automated test suite.  As a contributor, you are expected to perform some manual testing to ensure that your feature does not accidentally break something else in Octave Online Server.

Here are some critical user journeys that test a fairly wide cross-section of the code base.  **Please make sure that all of these journeys continue working after your change.**

1. The core file editor
	1. Sign in if necessary
	1. Create a new file
	1. Open the new file in the editor and make some changes
	1. The file should appear dirty (unsaved): its name should be italic and underlined
	1. Save the file; it should no longer appear dirty
	1. Press the "Refresh Files" button; your file should go away and reappear a few seconds later with the same changes you had made
	1. Click the following the buttons in the file toolbar, and make sure they behave as expected:
		- "Download File"
		- "Print File"
		- "Toggle Word Wrap"
		- "Save File" (make some changes first)
		- "Run Script"
	1. Create a file named `.octaverc` with the following content:
	```rcx = 5;```
	1. Run the `exit` command, then click the reconnect link
	1. Once the workspace loads, check that the variable `rcx` exists and has value 5
1. Collaborative workspaces
	1. Sign in if necessary
	1. Open the side bar menu and enable workspace sharing if necessary
	1. Open the sharing link in another window
	1. Repeat all of the steps from the "core file editor" journey, mixed between the two windows, and make sure that all state gets updated as expected
1. Plotting and image processing
	1. In the main command prompt, make some standard plots like `sombrero()` and `fplot(@sin, [-pi pi])`, and ensure they appear as expected
	1. Open the plot window.  You should be able to scroll through your plots.  Ensure that the two download buttons work as expected (download as PNG and as SVG)
	1. Sign in if necessary
	1. Download a full-color image from [PNGNQ](http://pngnq.sourceforge.net/pngnqsamples.html); I usually use mandrill.png
	1. Drag the PNG file onto the file list until it turns yellow; drop the file to upload it
	1. Select the file in the list; make sure "Download File" and "Rename File" work
	1. Click the "DELETE File" button to delete the file
	1. Upload the file again, this time using the "Upload file" button in the file list toolbar
	1. In the command prompt, run the following command: `imshow(imread("mandrill.png"))`; you should see the full-color image appear in the console output window (there is a surprisingly large amount of code that is needed to make this happen)
1. Buckets and static file sharing
	1. Sign in if necessary
	1. Create or upload multiple files if you don't already have files in your workspace
	1. Open a script file that runs by itself (not a function file)
	1. Click the "Share File in new Bucket" button
	1. Play around with the options, adding new files and selecting a main file
	1. Click "Create Bucket"
	1. Ensure that the bucket creates successfully and that the main file runs
	1. Save the link to the bucket
	1. Go back to the main Octave Online Server window, signed in to your account
	1. Open the side bar menu
	1. Find the bucket you created; ensure that the timestamp is correct
	1. Press the "⌫" button to delete the bucket
	1. Once deleted, go back to the bucket with the link you saved a few steps above, and ensure that the bucket is deleted
1. Small interpreter features
	1. Run a few lines of code and then run `clc`; it should clear all output from the console window
	1. Run `doc fplot`; it should produce a working link
	1. Run `char(randi(256, 1000, 1)' .- 1)`; it should print a nonsense string with a lot of replacement characters
	1. Run `O = urlread("http://example.com")`; it should finish without error and print the HTML content of that page
	1. Run `O = urlread("https://example.com")`; it should print the same HTML as the previous line (http vs https)
	1. Run `O = urlread("http://cnn.com")`; it should print an error saying that the domain is not in the whitelist (unless you added that domain to your custom whitelist)
	1. Run `ping`; you should see a response like "Ping time: 75ms"
1. Octave feature coverage
	1. Run `pkg load communications` and then `help gf`; you should get a help page (skip this if you don't install the communications package)
	1. Run `audioread("dummy.wav")`; you should get an error that the file does not exist (but you should NOT get an error that says libsndfile was not installed)
1. Student / instructor features
	1. Create two accounts if you do not already have two accounts
	1. In one account, add a string to the `instructor` field in mongodb; for example, `"test-course"`
	1. Sign in to Octave Online Server using the other account
	1. Run `enroll("test-course")` and follow the onscreen instructions
	1. Sign out and sign into the first account, the one with the instructor field
	1. Ensure that the student is listed in the menu bar
	1. Sign out and back into the student account
	1. Open the menu and try disabling sharing; it should deny permission
	1. Run `enroll("default")` and follow the onscreen instructions
	1. Open the menu and try disabling sharing again; it should work this time
1. Network connection and reconnecting to a session
	1. Open your Octave Online Server as a guest user (not signed in)
	1. Type `x = 5` and press Enter, followed by `x` and Enter, to ensure that the variable is set correctly
	1. Terminate (Ctrl-C) your front server process and quickly restart it
	1. The loading animation should appear on the browser window, and the animation should go away once the front server has finished restarting.  In addition, the phrase "Connection lost.  Attempting to reconnect..." should be printed to the console window.  When the server reconnects, the prompt should activate
	1. Type `x` and Enter; the variable should still have the value 5
	1. Type `exit`; it should say "Octave Exited. Message: Shell Exited", and you should get a link that says "Click Here to Reconnect"
	1. Terminate (Ctrl-C) your front server process and quickly restart it
	1. The loading animation should appear on the browser window, and the animation should go away once the front server has finished restarting.  However, you should NOT get the "Connection lost" message printed to the console, and you should NOT get an active prompt automatically after the animation goes away
	1. Press the "Click Here to Reconnect" button; you should now get an active command prompt.  Run a command or two to make sure the session is working normally
	1. For an exhaustive test, repeate this section as (i) a signed-in user, (ii) a session with sharing enabled, and (iii) a bucket session.
1. Reconnecting to and expiring collaborative workspaces
	1. Sign in to a user that has sharing enabled
	1. *Ensure that no one else is viewing the user's workspace* (for example, there should be no red cursors at the command prompt)
	1. Set a variable like `x = 99`
	1. Reload the browser window; it should be the same session.  Check that `x` is still `99`
	1. Close the browser window without exiting explicitly
	1. Wait for `config.redis.expire.timeout` milliseconds to ellapse, then open up a new tab for that user; it should be a new session.  Check that `x` is no longer set to `99`
1. GUI: Flexbox panels and CSS
	1. Hover over the border between panels; a slider should appear.  Drag the slider around to resize the panels
	1. Open the menu and click "Change/Reset Layout"; the panel sizes should reset to the defaults
	1. Open the menu and click "Change Theme"; you should get a dark theme.  Clicking the button again should change the theme back
1. GUI: Function arguments and filenames
	1. Run the command `edit demo_fn.m`; it should create a new file with that name and open it in the editor
	1. Enter the following content for that file:
	```
	function [o] = demo_fn(x)
	o = x*2;
	endfunction
	```
	1. Click the "Run" button.  You should get a prompt asking you for the value of x.  Enter a value such as 3.  You should now see `ans = 6` in the console output window
	1. Press Command+R or Control+R.  The same prompt should appear
	1. Attempt to create another new file with the same name, `demo_fn.m`, using the "Create empty file" button.  You should not be able to create a file with that name since it already exists
1. GUI: Command prompt features
	1. Type `fpl` into the prompt box, then hit TAB.  You should get a menu of auto-completions like `fplot`
	1. Run several commands, such as `x=1` then `x=2` then `x=3`.  Press the up arrow.  You should be able to scroll through your command history
	1. You should see "x" in the Vars menu.  Click on the x.  A dialog should open telling you the current value of x
	1. Within the command output panel, click on command text, to the right of the "octave:#>".  That command should appear in the URL bar
	1. Reload the page.  The command you clicked (the one now in the URL) should be automatically executed after the page loads
1. GUI: Legal and account management
	1. Open the side bar menu.  Click on "Privacy Policy and EULA".  A dialog should open showing that content
	1. Make sure you are signed in
	1. Click "Change Password".  Follow the instructions to change the password
	1. Sign out and sign back in using your new password to make sure it worked
1. GUI: Folders
	1. Use the "Create empty file" button to create a file named "dir1/foo.m".  It should create a file in that subdirectory, "dir1", shown in the file list panel
	1. Enter the command `cd dir1`; you should now be changed into that directory and there should be a small window reminding you in the top left of the console output window
1. Pushing the limits: File Size
	1. Make sure you are *not* signed in
	1. Run the following command line; it should finish without any errors:
	```A = rand(500); save A.mat; load A.mat```
	1. Run the following command line; it should produce the error "load: failed to load matrix constant", due to hitting the 20 MB file size limit per workspace:
	```A = rand(5000); save A.mat; load A.mat```
1. Pushing the limits: Message Size
	1. Run the following command line; it should finish without any errors and produce a busy line plot:
	```plot(rand(100));```
	1. Run the following command line; it should produce the error "Warning: Suppressed a large plot", due to hitting the 1 MB limit on message size and therefore plot size:
	```plot(rand(300));```
1. Pushing the limits: Countdown / Time Limit
	1. Run the following command:
	```pause(12)```
	1. When the "Add 15 Seconds" link appears, click it
	1. Ensure that the time runs out after 12 seconds from the original entry of the command
1. Pushing the limits: Payload and signals
	1. Run the following command:
	```x = 0; while(true), x += 1, end```
	1. The variable `x` should get to somewhere between 1500 and 2000 before being paused for payload
	1. Click the "Resume Execution" button, and `x` should climb by approximately the same amount
	1. Click the x button to stop execution.  There may be a bit more output, but you should soon be returned to the command prompt
	1. Repeat the above steps, but instead of clicking the x button, wait for the payload timeout to finish on its own and return you to the command prompt

Tip: A community member like you could implement an automated end-to-end test suite.  If this is your area of expertise, please open an issue and engage!

## License

Octave Online Server is licensed under the [GNU Affero General Public License](https://en.wikipedia.org/wiki/Affero_General_Public_License).

> Octave Online Server is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
>
> Octave Online Server is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details.

A copy of the license can be found in COPYING.

Note: You may contact webmaster@octave-online.net to inquire about other options for licensing Octave Online Server.
