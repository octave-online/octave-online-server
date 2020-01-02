# Copyright © 2018, Octave Online LLC
#
# This file is part of Octave Online Server.
#
# Octave Online Server is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at your
# option) any later version.
#
# Octave Online Server is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
# or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
# License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with Octave Online Server.  If not, see
# <https://www.gnu.org/licenses/>.

SHELL := /bin/bash
NODE = node

# Read options from config file
# \n is replaced with \1 because gnumake removes \n from ${shell}. See: https://stackoverflow.com/q/54067438/1407170
get_config = ${shell $(NODE) -e "console.log(require('./shared').config.$(1))" | tr '\n' '\1'}
GIT_HOST      = $(call get_config,git.hostname)
GIT_DIR       = $(call get_config,docker.gitdir)
WORK_DIR      = $(call get_config,docker.cwd)
OCTAVE_SUFFIX = $(call get_config,docker.images.octaveSuffix)
FILES_SUFFIX  = $(call get_config,docker.images.filesystemSuffix)
JSON_MAX_LEN  = $(call get_config,session.jsonMaxMessageLength)
CGROUP_CONF   = $(call get_config,selinux.cgroup.conf)


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
	systemctl daemon-reload
	echo "$(CGROUP_CONF)" | tr '\1' '\n' > /etc/cgconfig.d/oo.conf
	echo "Run `systemctl restart cgconfig.service` to load changes to cgroup configurations."
	systemctl enable cgconfig
	ln -sf $$PWD /usr/local/share/oo

install-site-m:
	cp back-octave/octaverc.m /usr/local/share/octave/site/m/startup/octaverc

docker: docker-octave docker-files

lint:
	cd back-filesystem && npm run lint
	cd back-master && npm run lint
	cd shared && npm run lint
	cd utils-auth && npm run lint

clean:
	if [[ -e bundle ]]; then rm -rf bundle; fi
