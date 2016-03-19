SHELL := /bin/bash

# Read options from config.json
GIT_HOST = $(shell jq -r ".git.hostname" shared/config.json)
GIT_DIR = $(shell jq -r ".docker.gitdir" shared/config.json)
WORK_DIR = $(shell jq -r ".docker.cwd" shared/config.json)
OCTAVE_SUFFIX = $(shell jq -r ".docker.images.octaveSuffix" shared/config.json)
FILES_SUFFIX = $(shell jq -r ".docker.images.filesystemSuffix" shared/config.json)
JSON_MAX_LEN = $(shell jq -r ".session.jsonMaxMessageLength" shared/config.json)

docker-octave:
	if [[ -e bundle ]]; then rm -rf bundle; fi
	mkdir bundle
	cat dockerfiles/base.dockerfile \
		>> bundle/Dockerfile
	cat dockerfiles/build-octave.dockerfile \
		>> bundle/Dockerfile
	cat dockerfiles/entrypoint-octave.dockerfile \
		| sed -e "s;%JSON_MAX_LEN%;$(JSON_MAX_LEN);g" \
		>> bundle/Dockerfile
	cp -rL back-octave/* bundle
	docker build -t oo/$(OCTAVE_SUFFIX) bundle
	rm -rf bundle

docker-files:
	if [[ -e bundle ]]; then rm -rf bundle; fi
	mkdir bundle
	cat dockerfiles/base.dockerfile \
		>> bundle/Dockerfile
	cat dockerfiles/install-node.dockerfile \
		>> bundle/Dockerfile
	cat dockerfiles/filesystem.dockerfile \
		| sed -e "s;%GIT_DIR%;$(GIT_DIR);g" \
		| sed -e "s;%GIT_HOST%;$(GIT_HOST);g" \
		>> bundle/Dockerfile
	cat dockerfiles/entrypoint-filesystem.dockerfile \
		| sed -e "s;%GIT_DIR%;$(GIT_DIR);g" \
		| sed -e "s;%WORK_DIR%;$(WORK_DIR);g" \
		>> bundle/Dockerfile
	cp -rL back-filesystem bundle
	docker build -t oo/$(FILES_SUFFIX) bundle
	rm -rf bundle

docker-master-docker:
	echo "This image would require using docker-in-docker.  A pull request is welcome."

docker-master-selinux:
	echo "It is not currently possible to install SELinux inside of a Docker container."

install-selinux-policy:
	# yum install -y selinux-policy-devel policycoreutils-sandbox selinux-policy-sandbox
	cd entrypoint/policy && make -f /usr/share/selinux/devel/Makefile octave_online.pp
	semodule -i entrypoint/policy/octave_online.pp
	restorecon -R -v /usr/local/lib/octave
	restorecon -R -v /tmp
	setenforce enforcing
	echo "For maximum security, make sure to put SELinux in enforcing mode by default in /etc/selinux/config."

install-selinux-bin:
	cp entrypoint/back-selinux.js /usr/local/bin/oo-back-selinux
	cp entrypoint/oo.service /usr/lib/systemd/system/oo.service
	ln -sf $$PWD /usr/local/share/oo

install-site-m:
	if [[ -e /usr/local/share/octave/site/m/placeholders ]]; then rm -rf /usr/local/share/octave/site/m/placeholders; fi
	back-octave/bin/make_placeholders.js
	cp -r back-octave/placeholders /usr/local/share/octave/site/m/placeholders
	cp back-octave/octaverc.m /usr/local/share/octave/site/m/startup/octaverc

docker: docker-octave docker-files

clean:
	if [[ -e bundle ]]; then rm -rf bundle; fi
