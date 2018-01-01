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
	lapack64-devel \
	librsvg2-tools \
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
	hg import ../oo-changesets/103-352b599bc533.hg.txt

RUN cd octave && \
	./bootstrap && \
	mkdir build-oo

### 4.0.1-rc1 ###
# RUN	cd build-oo && \
# 	../configure --disable-readline --disable-gui --disable-docs

### 4.2.1 ###
RUN cd build-oo && \
	../configure --disable-readline --disable-docs --disable-atomic-refcount --without-qt

# Build Octave
# This is the slowest part of the Dockerfile
RUN cd octave/build-oo && make
RUN cd octave/build-oo && make install

# Monkey-patch bug #42352
# https://savannah.gnu.org/bugs/?42352
RUN touch /usr/local/share/octave/4.0.1-rc1/etc/macros.texi

# Monkey-patch json-c runtime errors
ENV LD_LIBRARY_PATH /usr/local/lib

# Install some popular Octave Forge packages.
# Note that installing sympy involves installing numpy as well, which is rather large, but it is required for the symbolic package, which is one of the most popular packages in Octave Online.
# Install 5 at a time so it's easier to recover from build errors.  If a package fails to install, try building the image again and it might work the second time.
# The packages with -noauto have functions that shadow core library functions, or are packages that are slow to load.
RUN yum install -y \
	units \
	mpfr-devel \
	portaudio-devel \
	sympy \
	patch
RUN octave -q --eval "\
	pkg install -forge -auto control; \
	pkg install -forge -auto signal; \
	pkg install -forge -auto struct; \
	pkg install -forge -auto optim; \
	pkg install -forge -auto io; "
RUN octave -q --eval "\
	pkg install -forge -auto image; \
	pkg install -forge -auto symbolic; \
	pkg install -forge -auto statistics; \
	pkg install -forge -auto general; \
	pkg install -forge -auto odepkg; "
RUN octave -q --eval "\
	pkg install -forge -auto linear-algebra; \
	pkg install -forge -auto communications; \
	pkg install -forge -auto geometry; \
	pkg install -forge -auto data-smoothing; \
	pkg install -forge -noauto tsa; "
RUN octave -q --eval "\
	pkg install -forge -auto financial; \
	pkg install -forge -auto miscellaneous; \
	pkg install -forge -auto interval; \
	pkg install -forge -noauto stk; \
	pkg install -forge -noauto ltfat; "
RUN octave -q --eval "\
	pkg install -forge -auto fuzzy-logic-toolkit; \
	pkg install -forge -auto mechanics; \
	pkg install -forge -noauto nan; "

# Copy placeholders
COPY placeholders /usr/local/share/octave/site/m/placeholders/

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
