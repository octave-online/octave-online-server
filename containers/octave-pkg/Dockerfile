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

ARG FULL_BASE_IMAGE
FROM $FULL_BASE_IMAGE

# Install some popular Octave Forge packages.
# If a package fails to install, try building the image again and it might work the second time.
# Most packages are auto-loaded via octaverc (since version 4.2.1) except for the following packages that shadow core library functions or are slow to load: tsa, stk, ltfat, and nan.
# Note: The package list gets written to /usr/local/share/octave/octave_packages
RUN yum install -y \
	units \
	mpfr-devel \
	portaudio-devel \
	patch \
	ncurses-devel \
	libicu-devel \
	python3-pip

RUN pip3 install sympy

ARG PKG_BASE_URL=https://downloads.sourceforge.net/project/octave/Octave%20Forge%20Packages/Individual%20Package%20Releases

RUN mkdir pkg-downloads && \
	cd pkg-downloads && \
	wget $PKG_BASE_URL/control-3.2.0.tar.gz && \
	wget $PKG_BASE_URL/signal-1.4.1.tar.gz && \
	wget $PKG_BASE_URL/communications-1.2.2.tar.gz && \
	wget $PKG_BASE_URL/struct-1.0.16.tar.gz && \
	wget $PKG_BASE_URL/io-2.6.1.tar.gz && \
	wget $PKG_BASE_URL/statistics-1.4.2.tar.gz && \
	wget $PKG_BASE_URL/optim-1.6.0.tar.gz && \
	wget $PKG_BASE_URL/image-2.12.0.tar.gz && \
	wget $PKG_BASE_URL/general-2.1.1.tar.gz && \
	wget $PKG_BASE_URL/matgeom-1.2.2.tar.gz && \
	wget $PKG_BASE_URL/linear-algebra-2.2.3.tar.gz && \
	wget $PKG_BASE_URL/geometry-4.0.0.tar.gz && \
	wget $PKG_BASE_URL/data-smoothing-1.3.0.tar.gz && \
	wget $PKG_BASE_URL/nan-3.4.5.tar.gz && \
	wget $PKG_BASE_URL/tsa-4.6.2.tar.gz && \
	wget $PKG_BASE_URL/miscellaneous-1.3.0.tar.gz && \
	wget $PKG_BASE_URL/interval-3.2.0.tar.gz && \
	wget $PKG_BASE_URL/stk-2.6.1.tar.gz && \
	wget $PKG_BASE_URL/ltfat-2.3.1.tar.gz && \
	wget $PKG_BASE_URL/mechanics-1.3.1.tar.gz && \
	wget $PKG_BASE_URL/divand-1.1.2.tar.gz && \
	wget $PKG_BASE_URL/mapping-1.4.0.tar.gz && \
	wget $PKG_BASE_URL/financial-0.5.3.tar.gz && \
	wget $PKG_BASE_URL/symbolic-2.9.0.tar.gz && \
	wget https://github.com/apjanke/octave-tablicious/releases/download/v0.3.5/tablicious-0.3.5.tar.gz

# TODO: Package to consider adding:
# - fuzzy-logic-toolkit (present in older versions)

RUN export LC_ALL=C && \
	cd pkg-downloads && \
	/usr/local/bin/octave -q --eval "\
		pkg install control-3.2.0.tar.gz; \
		pkg install signal-1.4.1.tar.gz; \
		pkg install communications-1.2.2.tar.gz; \
		pkg install struct-1.0.16.tar.gz; \
		pkg install io-2.6.1.tar.gz; \
		pkg install statistics-1.4.2.tar.gz; \
		pkg install optim-1.6.0.tar.gz; \
		pkg install image-2.12.0.tar.gz; \
		pkg install general-2.1.1.tar.gz; \
		pkg install matgeom-1.2.2.tar.gz; \
		pkg install linear-algebra-2.2.3.tar.gz; \
		pkg install geometry-4.0.0.tar.gz; \
		pkg install data-smoothing-1.3.0.tar.gz; \
		pkg install nan-3.4.5.tar.gz; \
		pkg install tsa-4.6.2.tar.gz; \
		pkg install miscellaneous-1.3.0.tar.gz; \
		pkg install interval-3.2.0.tar.gz; \
		pkg install stk-2.6.1.tar.gz; \
		pkg install ltfat-2.3.1.tar.gz; \
		pkg install mechanics-1.3.1.tar.gz; \
		pkg install divand-1.1.2.tar.gz; \
		pkg install mapping-1.4.0.tar.gz; \
		pkg install financial-0.5.3.tar.gz; \
		pkg install symbolic-2.9.0.tar.gz; \
		pkg install tablicious-0.3.5.tar.gz; "

# Generate package metadata, used for warning messages
RUN cd /usr/local/share/octave/site/m && /usr/local/bin/octave -q --eval "\
	packages = {}; \
	for p=pkg('list'); \
		packages = {packages{:} pkg('describe', '-verbose', p{1}.name){:}}; \
	endfor; \
	save('package_metadata.mat', 'packages'); "
