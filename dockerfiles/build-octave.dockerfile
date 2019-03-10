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

# Install build dependencies for Octave
RUN yum install -y epel-release yum-utils
RUN yum-builddep -y octave
RUN yum install -y \
	mercurial \
	libtool \
	gcc-c++ \
	make \
	net-tools \
	traceroute \
	git \
	tar \
	bzip2-devel \
	lapack64-devel \
	librsvg2-tools \
	libsndfile-devel \
	icoutils \
	transfig

# When building without --disable-docs, the following additional packages are required:
# texlive-collection-latexrecommended
# texlive-metapost

# Build and install libuv
RUN git clone https://github.com/libuv/libuv.git && \
	cd libuv && \
	sh autogen.sh && \
	./configure && \
	make && \
	make install

# Build and install json-c with our custom UTF-8 sanitize patch
RUN git clone https://github.com/vote539/json-c.git && \
	cd json-c && \
	sh autogen.sh && \
	./configure && \
	make && \
	make install

# Enlist and Configure the correct Octave revision
RUN hg clone http://www.octave.org/hg/octave
COPY oo-changesets $DIR/oo-changesets/

### 4.0.1-rc1 ###
# RUN cd octave && \
# 	hg update 323e92c4589f && \
# 	hg import ../oo-changesets/001-d38b7c534496.hg.txt && \
# 	hg import ../oo-changesets/002-d3de6023e846.hg.txt && \
# 	hg import ../oo-changesets/003-4d28376c34a8.hg.txt && \
# 	hg import ../oo-changesets/004-6ff3e34eea77.hg.txt && \
# 	hg import ../oo-changesets/005-9e73fe0d92d5.hg.txt && \
# 	hg import ../oo-changesets/006-15d21ceec728.hg.txt && \
# 	hg import ../oo-changesets/007-4d778d6ebbd0.hg.txt && \
# 	hg import ../oo-changesets/008-e8ef7f3333bf.hg.txt && \
# 	hg import ../oo-changesets/009-05f7272c001e.hg.txt && \
# 	hg import ../oo-changesets/010-4a1afb661c55.hg.txt && \
# 	hg import ../oo-changesets/011-7327936fa23e.hg.txt && \
# 	hg import ../oo-changesets/012-84390db50239.hg.txt && \
# 	hg import ../oo-changesets/013-f4110d638cdb.hg.txt && \
# 	hg import ../oo-changesets/014-21fd506b7530.hg.txt

### 4.2.1 ###
RUN cd octave && \
	hg update b9d482dd90f3 && \
	hg import ../oo-changesets/100-2d1fd5fdd1d5.hg.txt && \
	hg import ../oo-changesets/101-bc8cd93feec5.hg.txt && \
	hg import ../oo-changesets/102-30d8ba0fbc32.hg.txt && \
	hg import ../oo-changesets/103-352b599bc533.hg.txt && \
	hg import ../oo-changesets/104-9475120a3110.hg.txt && \
	hg import ../oo-changesets/105-ccbef5c9b050.hg.txt && \
	hg import ../oo-changesets/106-91cb270ffac0.hg.txt && \
	hg import ../oo-changesets/107-80081f9d8ff7.hg.txt

RUN cd octave && \
	./bootstrap && \
	mkdir build-oo

### 4.0.1-rc1 ###
# RUN	cd build-oo && \
# 	../configure --disable-readline --disable-gui --disable-docs

### 4.2.1 ###
# Note: set GNUPLOT=... if you are using a custom gnuplot!
RUN cd build-oo && \
	../configure --disable-readline --disable-docs --disable-atomic-refcount --without-qt

# Build Octave
# This is the slowest part of the Dockerfile
RUN cd octave/build-oo && make
RUN cd octave/build-oo && make install

# Monkey-patch bug #42352
# https://savannah.gnu.org/bugs/?42352
RUN touch /usr/local/share/octave/4.2.1/etc/macros.texi

# Monkey-patch json-c runtime errors
ENV LD_LIBRARY_PATH /usr/local/lib

# Install some popular Octave Forge packages.
# Note that installing sympy involves installing numpy as well, which is rather large, but it is required for the symbolic package, which is one of the most popular packages in Octave Online.
# Install 5 at a time so it's easier to recover from build errors.  If a package fails to install, try building the image again and it might work the second time.
# Most packages are auto-loaded via octaverc (since version 4.2.1) except for the following packages that shadow core library functions or are slow to load: tsa, stk, ltfat, and nan.
# Note: The package list gets written to /usr/local/share/octave/octave_packages
RUN yum install -y \
	units \
	mpfr-devel \
	portaudio-devel \
	sympy \
	patch
RUN /usr/local/bin/octave -q --eval "\
	pkg install -forge control; \
	pkg install -forge signal; \
	pkg install -forge struct; \
	pkg install -forge optim; \
	pkg install -forge io; "
RUN /usr/local/bin/octave -q --eval "\
	pkg install -forge image; \
	pkg install -forge symbolic; \
	pkg install -forge statistics; \
	pkg install -forge general; "
RUN /usr/local/bin/octave -q --eval "\
	pkg install -forge linear-algebra; \
	pkg install -forge geometry; \
	pkg install -forge data-smoothing; \
	pkg install -forge nan; \
	pkg install -forge tsa; "
RUN /usr/local/bin/octave -q --eval "\
	pkg install -forge financial; \
	pkg install -forge miscellaneous; \
	pkg install -forge interval; \
	pkg install -forge stk; \
	pkg install -forge ltfat; "
RUN /usr/local/bin/octave -q --eval "\
	pkg install -forge fuzzy-logic-toolkit; \
	pkg install -forge mechanics; \
	pkg install -forge divand; \
	pkg install -forge mapping; "

# Some packages do not install correctly from Octave-Forge!
# odepkg - http://wiki.octave.org/Odepkg
RUN /usr/local/bin/octave -q --eval "\
	[fname, success] = urlwrite ('https://bitbucket.org/odepkg/odepkg/get/default.tar.gz', [P_tmpdir '/odepkg.tar.gz']); \
	assert(success)
	pkg ("install", fname) "
# communications - https://savannah.gnu.org/bugs/?46521
RUN hg clone https://bitbucket.org/octave-online/octave-communications && \
	cd octave-communications && \
	hg checkout patch-4.2 && \
	CXXFLAGS="--std=c++11 -I/usr/local/include" make all && \
	make install

# Generate package metadata, used for warning messages
RUN cd /usr/local/share/octave/site/m && /usr/local/bin/octave -q --eval "\
	packages = {}; \
	for p=pkg('list'); \
		packages = {packages{:} pkg('describe', '-verbose', p{1}.name){:}}; \
	endfor; \
	save('package_metadata.mat', 'packages'); "

# Copy and compile host.c
RUN mkdir $DIR/host
COPY host.c Makefile $DIR/host/
RUN cd host && make && make install

# Cleanup
RUN rm -rf /root/* && \
	yum remove -y \
		mercurial \
		libtool \
		gcc-c++ \
		make \
		net-tools \
		traceroute \
		git \
		icoutils \
		transfig
