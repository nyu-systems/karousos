#!/bin/bash

export NODE_OPTIONS="--max-old-space-size=25000 --unhandled-rejections=strict" 
export IS_VERIFIER=true
IS_PROVER=false

usage() {
	echo "Usage: $0 applicationName workloadName with flags:"
	echo "-o, --orochi-js: execute the verifier for orochi js. "
	echo "-i, --iterations:  iternation number. Default is 1"
}

# Get the number of iterations

export iterations=1
export OROCHI_JS=false;

has_argument() {
    [[ ("$1" == *=* && -n ${1#*=}) || ( ! -z "$2" && "$2" != -*)  ]];
}

extract_argument() {
  echo "${2:-${1#*=}}"
}

# Handle the options. The options should be provided before the arguments.
while [ $# -gt 0 ]; do
  case $1 in
    -h | --help)
      usage
      exit -1
      ;;
    -i | --iterations*)
      if ! has_argument $@; then
        echo "Iterations not specified." >&2
        usage
        exit -1
      fi
      iterations=$(extract_argument $@)
      shift
      ;;
    -o | --orochi-js*)
      export OROCHI_JS=true
      ;;
    *)
      break;
  esac
  shift
done

if [ $# -ne 2 ]; then
	echo "Wrong number of arguments. Check help by running runVerifier.sh -h"
	usage 
	exit -1
fi

# The name of the experiment
EXPERIMENT_NAME="$1-$2"
export EXPERIMENT="$1"

# Initialize the environment
source env.sh

function start_db_server {
	$mysqld_safe --basedir=$basedir --datadir=$datadir --binlog-format=$binlog_format --transaction-isolation=$isolation_level --user=$user --interactive_timeout=31536000 &
}

function stop_db_server {
	#Stop the service
	echo "closing the database"
	$mysqladmin -uroot -p"1234" shutdown
}

# Start the DB
start_db_server

# Run verifier $iterations times
for (( i=0; i<$iterations; i++ ))
do
	export ITERATION=$i
	source $KAR_HOME/src/env-measurements.sh

	NODE_ENV=production node "$KAR_HOME/src/runVerifier"
done

cd "$KAR_HOME/src"

# Stop the DB
stop_db_server
