#!/bin/bash

# Shell script to pull all student repositories from a program into
# a master repository.

# Read arguments
parametrized=$1;
program=$2;
db_name=$3;

function push_pull {
	# Commit all current files.
	git add -A;
	git commit -m "$1";

	# We want to avoid losing user's data in the HEAD.
	# 
	# If the remote is at a different commit than the local (when the user
	# has Octave Online open in multiple tabs, for instance), there may
	# be a merge conflict.  Commit the conflict into the repository, and
	# allow the user to manually fix the conflict next time they log in.
	git fetch;
	git merge --no-commit origin/master;
	git add -A;
	git commit -m "Scripted merge";

	# Push changes to the remote.
	git push origin master;
}

# Actual procedure starts here
(
	cd ~/tmp;
	git clone ~git/repos/$parametrized.git;
	cd $parametrized;
	echo "db.users.find({ program:'$program' }, { parametrized: 1, _id: 0 }).forEach( function(u) { print( u.parametrized ); } );" | mongo --quiet $db_name | \
	while read student; do
		if [ "$student" != "$parametrized" ]; then
			if [ -d $student ]; then
				rm -rf $student;
			fi
			git clone ~git/repos/$student.git;
			rm -rf $student/.git;
		fi
	done;
	push_pull "Updated students in program $program";
)
