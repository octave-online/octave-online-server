Containers for Octave Online Server
===================================

This directory contains up-to-date container definitions for various pieces of Octave Online Server.

Inside most directories, you will find at least two files:

- Dockerfile: The scripts to build the container.
- cloudbuild.yaml: For hooking up with Google Cloud Build.  You can ignore this file unless you want to use Google Cloud Build to build the containers.

Some directories contain additional assets used for building the respective containers.

**Important:** You should build all of the containers from the repository root and specify the Dockerfile via the `--file` option to `docker build` or `docker-compose`.  If necessary, your *config.hjson* file should be present when you run `docker build`.

The containers are:

- octave-\*: GNU Octave containers
- oo-front: Front server container
- oo-back: Back server container
- utils-gitd: Essential Git file server
- oo-gith: Frontend for the human-friendly file history viewer
- utils-gith: Backend for the human-friendly file history viewer
- utils-admin: Optional administration panel

## Running with Docker Compose

[Docker Compose](https://docs.docker.com/compose/) lets you configure and run multiple containers from a single configuration file.  Octave Online Server ships with *containers/oos-quick-start/docker-compose.yml* to get you off the ground quickly.

### Installing Docker Compose

1. [Install Docker Engine](https://docs.docker.com/engine/install/)
2. [Install Docker Compose](https://docs.docker.com/compose/install/)
3. Optional: [Set up Docker with a non-root user](https://docs.docker.com/engine/install/linux-postinstall/)

### Building All Images

From the repository root:

```bash
$ docker-compose -f containers/oos-quick-start/docker-compose.yaml build
```

It takes approximately one hour to build from scratch.

If you see an error such as "npm ERR! code ENOENT", please run the command again until it succeeds.

### Running Octave Online Server

From the repository root:

```bash
$ docker-compose -f containers/oos-quick-start/docker-compose.yaml run --publish 8080:8080 -d oo-front
$ docker-compose -f containers/oos-quick-start/docker-compose.yaml run -d oo-back
```

Octave Online Server should now be running on port 8080.

To run the file history server on port 8008:

```bash
$ docker-compose -f containers/oos-quick-start/docker-compose.yaml run --publish 8008:8008 -d oo-gith
```

### Configuration File with Docker Compose

Octave Online Server should run out of the box on Docker Compose without a custom configuration file.  To customize settings, create a config.hjson file as usual and rebuild the images.

When creating a custom config.hjson file, do *not* overwrite the various "hostname" and "port" settings for services that run in containers.  The default settings are required for the Docker containers to talk to each other.

Examples of settings that you may want to configure:

- session.legalTime.\* (amount of time allocated to running commands)
- mailgun.\* (Mailgun settings for email)
- auth.google.\* (Google OAuth settings)
- auth.easy.secret (salt for encrypting email tokens)
- front.cookie.secret (salt for encrypting session cookies)

### Optional: Create custom volumes for application data

By default, Docker will create volumes under */var/lib/docker/volumes* for Octave Online Server application data.  If you want to customize where application data is stored, you can create your own volumes in Docker.

```bash
# Loopback device to store MongoDB data (2 GB)
$ sudo dd if=/dev/zero of=/mnt/docker_mongodb.img bs=100M count=20
$ sudo mkfs.xfs /mnt/docker_mongodb.img
$ sudo losetup -fP /mnt/docker_mongodb.img

# Loopback device to store Git user data (4 GB)
$ sudo dd if=/dev/zero of=/mnt/docker_git.img bs=100M count=40
$ sudo mkfs.xfs /mnt/docker_git.img
$ sudo losetup -fP /mnt/docker_git.img

# Check the loopback mount locations:
$ losetup -a
/dev/loop0: []: (/mnt/docker_mongodb.img)
/dev/loop1: []: (/mnt/docker_git.img)

# Create the volumes in Docker; set the device paths according to `losetup -a`
$ docker volume create --driver local \
	--opt type=xfs \
	--opt device=/dev/loop0 \
	oosquickstart_mongodb
$ docker volume create --driver local \
	--opt type=xfs \
	--opt device=/dev/loop1 \
	oosquickstart_git
```

## About the GNU Octave Containers

There are four containers that are intended to be built in sequence, each one depending on the previous one.  The order is:

1. octave-deps (install build dependencies)
2. octave-stable (build vanilla GNU Octave from source)
3. octave-pkg (build packages)
4. octave-oo (build extensions for Octave Online Server)

Example commands to build these four containers in sequence (**Note: You do not need to run these commands if you are using docker-compose**)

```bash
# Run these commands from the top level directory
$ export SHORT_SHA=$(git rev-parse HEAD | cut -c 1-7)
$ docker build \
	--tag=octave-deps:$SHORT_SHA \
	--file=containers/octave-deps/Dockerfile \
	.
$ docker build \
	--build-arg=FULL_BASE_IMAGE=octave-deps:$SHORT_SHA \
	--tag=octave-stable:$SHORT_SHA \
	--file=containers/octave-stable/Dockerfile \
	.
$ docker build \
	--build-arg=FULL_BASE_IMAGE=octave-stable:$SHORT_SHA \
	--tag=octave-pkg:$SHORT_SHA \
	--file=containers/octave-pkg/Dockerfile \
	.
$ docker build \
	--build-arg=FULL_BASE_IMAGE=octave-pkg:$SHORT_SHA \
	--tag=octave-oo:$SHORT_SHA \
	--file=containers/octave-oo/Dockerfile \
	.
```

There are also *cloudbuild.yaml* files in each directory in case you want to use the Google Cloud Build service to build the Docker images.  With these files, you build each image in sequence, and when you get a clean build, set that image's tag as the `_BASE_REV` substitution on the subsequent image.  Each tag gets built based on the previous tag, so the tag in the end will have four short SHAs in sequence: "octave-oo:aaaaaaa-bbbbbbb-ccccccc-ddddddd"
