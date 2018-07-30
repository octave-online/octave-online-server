Octave Online Server: Back Server
=================================

This directory contains the source code for the Octave Online back server.

## Setup

There are two versions of the back server.  One uses Docker and is easier to set up and configure.  The other uses SELinux and is faster.

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

## Additional Setup

### Git SSH Key

If you use SSH to connect to the Git server containing people's saved files, you need to create a private key, save it at *back-filesystem/git/key.pem*, and export the variable `GIT_SSH=/path/to/back-filesystem/git/key.pem`.  You need to export that variable before you run `DEBUG=* node app.js` as described below.

## Running the Back Server

Go to the *back-master* directory and run `DEBUG=* node app.js` to start the back server.  The `DEBUG=*` is optional, but it gives you more details and can help with debugging problems.

## To-do list

- Update /usr/bin/sandbox according to https://github.com/SELinuxProject/selinux/commit/0f4620d6111838ce78bf5a591bb80c99c9d88730
- If using RHEL, the line "Defaults requiretty" must be commented out.
