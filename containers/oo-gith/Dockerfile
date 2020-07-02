# Copyright © 2020, Octave Online LLC
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

###################################
# oo-gith: front-end for Git HTTP #
# =============================== #
# - nginx                         #
# - utils-auth                    #
###################################

###############
# BOILERPLATE #
###############

FROM ubuntu:bionic

WORKDIR /root

# Disable all prompts when using apt-get
ENV DEBIAN_FRONTEND=noninteractive

# Core tmpfs directories:
VOLUME \
	/run \
	/tmp

# Essential setup
RUN \
	mkdir -p /srv/oo && \
	apt-get update && \
	apt-get install -y \
		curl \
		ca-certificates \
		openssl \
		apt-transport-https \
		gnupg \
		supervisor

# NodeSource
RUN \
	curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
	echo 'deb https://deb.nodesource.com/node_10.x bionic main' > /etc/apt/sources.list.d/nodesource.list && \
	echo 'deb-src https://deb.nodesource.com/node_10.x bionic main' >> /etc/apt/sources.list.d/nodesource.list

####################
# MAIN BUILD RULES #
####################

RUN apt-get update && \
	apt-get install --no-install-recommends -y \
		nodejs \
		nginx \
		git \
		unzip

# Install utils-auth
# Note: paths are relative to repository root
RUN mkdir -p /srv/oo/projects
COPY config*.hjson /srv/oo/projects/
COPY utils-auth /srv/oo/projects/utils-auth
COPY shared /srv/oo/projects/shared
RUN \
	cd /srv/oo/projects/shared && npm ci && \
	cd /srv/oo/projects/utils-auth && npm ci

# Download GitList for static file serving
RUN \
	curl -L -k https://github.com/octave-online/gitlist/archive/oo.zip -o gitlist.zip && \
	unzip gitlist.zip -d /srv/oo

############
# METADATA #
############

# Ports:
# 80 = nginx
EXPOSE 80/tcp

# Additional tmpfs directories:
VOLUME \
	/run/oosocks \
	/var/log/nginx \
	/var/lib/nginx

##################
# CONFIGURATIONS #
##################

# Note: paths are relative to repository root.
COPY utils-auth/configs/custom_4xx.html /var/www/html/
COPY containers/oo-gith/supervisord.conf /etc/supervisor/conf.d/oo.conf
COPY containers/oo-gith/nginx.conf /etc/nginx/sites-available/oo.conf

# TODO: In some environments, an error occurs due to modules-enabled. Why?
RUN \
	echo "daemon off;" >> /etc/nginx/nginx.conf && \
	rm /etc/nginx/modules-enabled/* && \
	sed -i "s/	access_log .*/	access_log \/dev\/stdout;/" /etc/nginx/nginx.conf && \
	sed -i "s/	error_log .*/	error_log \/dev\/stderr;/" /etc/nginx/nginx.conf && \
	(cd /etc/nginx/sites-enabled && rm default) && \
	(cd /etc/nginx/sites-enabled && ln -s ../sites-available/oo.conf) && \
	export GITH_HOST=$(node -e "console.log(require('/srv/oo/projects/shared').config.gith.hostname)") && \
	echo "Gith Host: $GITH_HOST" && \
	sed -i "s/oo-utils/$GITH_HOST/g" /etc/nginx/sites-available/oo.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/oo.conf"]
