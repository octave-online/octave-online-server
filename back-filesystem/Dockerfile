### DO NOT RUN "docker build" ON THIS FILE DIRECTLY!
### INSTEAD, RUN "bundle.sh"

FROM centos:latest
ENV DIR /root
WORKDIR $DIR

# Install dependencies from yum, including NodeJS
RUN curl --silent --location https://rpm.nodesource.com/setup_4.x | bash -
RUN yum install -y git nodejs libicu-devel

# Set up Git authentication
ENV GIT_SSH $DIR/git/git_ssh.sh
RUN mkdir ~/.ssh && \
	ssh-keyscan -t rsa octave-online.net >> ~/.ssh/known_hosts

# Copy source files
COPY . $DIR/

# Entrypoint
ENTRYPOINT [ "node", "app.js" ]
