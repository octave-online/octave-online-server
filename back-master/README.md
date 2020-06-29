Octave Online Server: Back Server
=================================

This directory contains the source code for the Octave Online Server back server.  This is the "master" process that communicates with the downstream user via Redis and with the GNU Octave subprocess.  Commands dealing with the filesystem are in the *back-filesystem* directory parallel to this directory.

## Setup

There are three versions of the back server.

1. Docker: Moderately easy to set up and configure.
2. SELinux: Fast, and able to handle many concurrent sessions.
3. Unsafe: Fast and easy, but not recommended with untrusted users. Every Octave process is run without any sandboxing or resource limitations.

### Option 1: Docker Setup

Download and install [Docker](https://www.docker.com).

Run `make docker` from the project directory to build the required Docker images.  Building the images, especially the *docker-octave* image, will take time, so be patient.  You may want to let this step run overnight.

### Option 2: SELinux

Ensure that you are running on CentOS or another distribution of Linux that supports SELinux.  SELinux should come pre-installed on CentOS.

Make and build Octave from source.  Follow a procedure similar to the one put forth in *dockerfiles/build-octave.dockerfile*.

Run `sudo yum install -y selinux-policy-devel policycoreutils-sandbox selinux-policy-sandbox libcgroup-tools`

Ensure that Node.js is installed and the dependencies are downloaded for the shared project:

	$ (cd shared && npm install)

Run all of the following make commands from the projects directory.

- `sudo make install-cgroup`
- `sudo make install-selinux-policy`
- `sudo make install-selinux-bin`
- `sudo make install-site-m`

### Option 3: Unsafe

Follow the Option 2 instructions to build and install Octave from source.  Stop before installing selinux-policy-devel and other selinux packages.

## Running the Back Server

### Debugging

Go to the *back-master* directory and run `DEBUG=* node app.js` to start the back server.  The `DEBUG=*` enables debug logging.

### Production

`node app.js` can be run directly, but consider using `oo.service` in the *entrypoint* directory parallel to this directory.

## Stopping the Back Server

By default, after the back server receives a successful maintenance request, it will wait for all sessions to close, and then cleanup and exit with code 0.

If you wish to cause the back server process to gracefully release all sessions without exiting, you can send the signal SIGUSR1 to the process.

## To-do list

- Update /usr/bin/sandbox according to https://github.com/SELinuxProject/selinux/commit/0f4620d6111838ce78bf5a591bb80c99c9d88730
- If using RHEL, the line "Defaults requiretty" must be commented out.
