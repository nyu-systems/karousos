#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=8196" 

usage() {
	echo "Usage: $0 applicationName workloadName with flags:"
	echo "-u, --unmodified: run the unmodified server. If the flag is not specified, run the Karousos server. "
	echo "-o, --collect-orochi-js-advice: also collect advice for orochi js. "
	echo "-i, --iterations:  iternation number. Default is 1"
}

iterations=1
export COLLECT_OROCHI_JS_ADVICE=false;
unmodified_server=false;

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
    -o | --collect-orochi-js-advice*)
      export COLLECT_OROCHI_JS_ADVICE=true
      ;;
    -u | --unmodified*)
      unmodified_server=true
      ;;
    *)
      break;
  esac
  shift
done

if [ $# -ne 2 ]; then 
	echo "Incorrect number of arguments"
	usage
	exit -1
fi

# IS_PROVER is true iff we are running the karousos server
export IS_PROVER=true
if "$unmodified_server"; then
	export IS_PROVER=false
	export ADVICE_MODE=0
fi
export IS_VERIFIER=false
#Get the folder that contains the workload 
export CONF_FILE=$PWD/workloads/$1/$2

# Check that the configuration file is valid
if [[ ! -d $CONF_FILE ]] ; then
	echo "Configuration folder $2 does not exists. Make sure that you supply a valid configuration folder in workloads/$1 with no extension"
	exit -1
fi

# The number of threads is the number of files in the workload folder
export NO_THREADS=$(ls $CONF_FILE | wc -l)
# Set up the environment
export EXPERIMENT_NAME="$1-$2"
export EXPERIMENT="$1"
source env.sh

# Number of ms that until we shut down the server
if [[ -z "${KEEP_ALIVE_FOR}" ]]; then
	export KEEP_ALIVE_FOR=40000
fi

#Initialize ver_info: the data that the verifier needs to verify the workload
function init_verinfo {
	echo "Removing advice $ADVICE_DIR"
	rm -r "${ADVICE_DIR}"
	mkdir -p "${ADVICE_DIR}${OBJECT_OLS_LOC}"
	if $COLLECT_OROCHI_JS_ADVICE; then
		rm -r "${ADVICE_DIR_OROCHI_JS}"
		mkdir -p "${ADVICE_DIR_OROCHI_JS}${OBJECT_OLS_LOC}"
	fi
}

function start_db_server {
	$mysqld_safe --basedir=$basedir --datadir=$datadir --binlog-format=$binlog_format --transaction-isolation=$isolation_level --user=$user & 
}

function stop_db_server {
	if [ ! $IS_PROVER ]; then
		#This is a good opportunity to clear the database
		$mysql -u root -p"1234" -D "test" -e "DELETE FROM stackTrace" 	
		$mysql -u root -p"1234" -D "test" -e "DELETE FROM inventory" 	
	fi	
	# Stop the service
	$mysqladmin -uroot -p"1234" shutdown
	# If we were running the Karousos server, parse the binary log to get the write log. 
	if $IS_PROVER; then
		curr_binlog=$(tail -1 $datadir/binlog.index | cut -d '/' -f 2)
		number=${curr_binlog#*.}
		binlog="$datadir/$curr_binlog"
		$mysqlbinlog --database=$database -v $binlog > $binlog_txt
		echo $binlog_txt "${ADVICE_DIR}${WRITELOG_LOC}" | python3 $parser
		if $COLLECT_OROCHI_JS_ADVICE; then
			cp "${ADVICE_DIR}${WRITELOG_LOC}" "${ADVICE_DIR_OROCHI_JS}${WRITELOG_LOC}"
		fi
		rm $binlog_txt
	fi	
}

function send_workload {
	# Wait until the server is set up
	if [ $EXPERIMENT == "wiki" ]; then
		sleep 15s
		# Now, send the workload with wrk
		# Duration in seconds
		duration=$(( ${KEEP_ALIVE_FOR}/1000 - 15 ))
	else 
		sleep 4s
		# Now, send the workload with wrk
		# Duration in seconds
		duration=$(( ${KEEP_ALIVE_FOR}/1000 - 4 ))
	fi
	OUT=$(wrk -c$NO_THREADS -d"$duration"s --timeout 10s -t$NO_THREADS -s $KAR_HOME/src/send_request_lua/send_request_$EXPERIMENT.lua --latency http://localhost:8000)
	echo $OUT
	# If we need to retry the workload because of an error, return 1
	if [[ "$OUT" == *"RETRY"* ]]; then
		return 1
	else
		return 0
	fi
}

# Run the server on the specified workloads $iterations times
i=0;
while [ $i -lt $iterations ]
do	
	echo $i
	export ITERATION=$i

	# Generate a random number used to randomize the fields of the requests in the 
	# workload (this is so that we can use the same workload configuration multiple times 
	# without inserting duplicate entries in the DB).
	export EXP_NUMBER=$(date +%s%N | cut -b10-19)
	
	source $KAR_HOME/src/env-measurements.sh
	
	cd "$DST_CODE"

	# Start the DB

	start_db_server

	sleep 3s


	#Jeffery: initialize database
	if [ "$EXPERIMENT" == "wiki" ]; then
		node $KAR_HOME/src/initWiki/createDb.js
	fi

	sleep 5s

	# Initialize the environment
	echo $IS_PROVER
	if $IS_PROVER; then 
		init_verinfo
	fi

	# Send the workload
	send_workload &
	pid=$!

	# Start the server	
	NODE_ENV=production node "$KAR_HOME/src/runServer" $IS_PROVER

	# Stop the DB
	stop_db_server

	# Generate the trace from the temporary trace file that contains timestamps
	cd "$KAR_HOME/src"
	if $IS_PROVER; then
		python3 create_trace.py "${ADVICE_DIR}${TRACE_TEMP_LOC}" "${ADVICE_DIR}${TRACE_LOC}"
		if $COLLECT_OROCHI_JS_ADVICE; then
			python3 create_trace.py "${ADVICE_DIR_OROCHI_JS}${TRACE_TEMP_LOC}" "${ADVICE_DIR_OROCHI_JS}${TRACE_LOC}"
		fi
	fi
	
	# Wait for wrk to finish sending the requests. 
	wait $pid
	if [ "$?" == "0" ]; then
		# Only move on to the next iteration if there were no errors while sending the 
		# requests 
		i=$((i+1))
		if [ "$iterations" -ne "1" ]; then
			# Wait before repeating the experiment
			sleep 20s
		fi
	fi
done
