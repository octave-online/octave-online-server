### DO NOT RUN "docker build" ON THIS FILE DIRECTLY!
### INSTEAD, RUN "bundle.sh"

FROM centos:latest
ENV DIR /root
WORKDIR $DIR

# Install dependencies from yum, including NodeJS
RUN curl --silent --location https://rpm.nodesource.com/setup_4.x | bash -
RUN yum install -y git nodejs libicu-devel gcc-c++ make

# Set up Git authentication
# FIXME: Config option
ENV GIT_SSH $DIR/git/git_ssh.sh
RUN mkdir ~/.ssh && \
	ssh-keyscan -t rsa 192.168.3.1 >> ~/.ssh/known_hosts

# Copy package.json and npm install
COPY package.json $DIR/
RUN npm install

# Copy remaining source files
COPY . $DIR/

# Entrypoint
ENTRYPOINT [ "node", "app.js" ]
