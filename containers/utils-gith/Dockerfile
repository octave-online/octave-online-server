# Copyright © 2019, Octave Online LLC
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

###########################################
# utils-gith: extra Git services for HTTP #
# ======================================= #
# - php-fpm + GitList                     #
# - fastcgi + git-http-backend            #
###########################################

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

# The repository root is expected to be mounted here:
VOLUME /srv/oo/git

####################
# MAIN BUILD RULES #
####################

RUN apt-get update && \
	apt-get install --no-install-recommends -y \
		git \
		nodejs \
		php-fpm \
		php-cli \
		php-json \
		php-xml \
		unzip \
		fcgiwrap

# Install GitList
# Note: php-fpm defaults to user "www-data" on Ubuntu 18.04
RUN \
	curl -L -k https://github.com/octave-online/gitlist/archive/oo.zip -o gitlist.zip && \
	unzip gitlist.zip -d /srv/oo && \
	cd /srv/oo/gitlist-oo && \
	(curl -s http://getcomposer.org/installer | php) && \
	php composer.phar install --no-dev

############
# METADATA #
############

# Ports:
# 3013 = git-http-backend
# 3023 = php-fpm
EXPOSE 3013/tcp 3023/tcp

# Additional tmpfs directories:
VOLUME \
	/run/php \
	/srv/oo/gitlist-oo/cache

##################
# CONFIGURATIONS #
##################

# Note: paths are relative to repository root
COPY utils-auth/configs/gitlist.ini /srv/oo/gitlist-oo/config.ini
COPY containers/utils-gith/supervisord.conf /etc/supervisor/conf.d/oo.conf

RUN \
	useradd -m -u 1600 git && \
	sed -i "s/error_log = .*/error_log = \/dev\/stderr/" /etc/php/7.2/fpm/php-fpm.conf && \
	sed -i "s/;daemonize = .*/daemonize = no/" /etc/php/7.2/fpm/php-fpm.conf && \
	sed -i "s/listen = .*/listen = 3023/" /etc/php/7.2/fpm/pool.d/www.conf

 # && \
	# sed -i "s/;chroot =/chroot = \/srv\/oo/" /etc/php/7.2/fpm/pool.d/www.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/oo.conf"]
