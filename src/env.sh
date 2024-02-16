#!/bin/bash

if [ "$KAR_HOME" == "" ]; then
	echo "ERROR: environment variable KAR_HOME is not defined"
	exit 1
fi

# Different values of ADVICE_MODE correspond to different
# parts of the advice collection procedure being turned off.
# Specifically:
# ADVICE_MODE=0 -> full karousos server
# ADVICE_MODE=1 -> full karousos server but turn off the saving the
# requests on disk
# ADVICE_MODE=2 -> Same as ADVICE_MODE=1 and additionally turn off
# logic for collecting advice for variable ops
# ADVICE_MODE=3 -> Same as ADVICE_MODE=2 and additionally turn off
# logic for collecting the rest of the advice
# ADVICE_MODE=4 -> Same as ADVICE_MODE=3 and additionally turn off
# logic for keeping track of object ids and handler ids
# ADVICE_MODE=5 -> Same as ADVICE_MODE=4 and additionally turn off
# wrap of functions (we need to recompile the server code in this case)
if [[ -z "${ADVICE_MODE}" ]]; then
  export ADVICE_MODE="0"
fi

# Number of requests to ignore when collecting measurements at the server.
# We ignore them because these requests are used for warm up
if [[ -z "${IGNORE_REQS}" ]]; then
  export IGNORE_REQS="0"
fi

#----Set the location of the information we collect for the verifier
if $IS_PROVER; then
	export ADVICE_DIR="$KAR_HOME/src/advice/karousos_${EXPERIMENT_NAME}"
	if $COLLECT_OROCHI_JS_ADVICE; then
		export ADVICE_DIR_OROCHI_JS="$KAR_HOME/src/advice/orochi_js_${EXPERIMENT_NAME}"
	fi
elif $IS_VERIFIER; then
	if $OROCHI_JS; then
		export ADVICE_DIR="$KAR_HOME/src/advice/orochi_js_${EXPERIMENT_NAME}"
	else
		export ADVICE_DIR="$KAR_HOME/src/advice/karousos_${EXPERIMENT_NAME}"
	fi
fi

# Relative locations of advice/trace inside the advice folder.
export TRACE_LOC="/trace.csv"
export TRACE_TEMP_LOC="/trace_temp.txt"
export ADVICE_LOC="/advice"
export REPORTS_LOC="${ADVICE_LOC}/advice_per_req"
export WRITELOG_LOC="${ADVICE_LOC}/writelog.json"
export OBJECT_OLS_LOC="${ADVICE_LOC}/objectOls/"

#----Needed for compilation

export PLUGIN_LOC="$KAR_HOME/src/compiler/src/babel-plugin.js"

# Where to find the programmer annotated libraries
export ANNOTATED_LIBS="$KAR_HOME/src/annotated_libs/"
export ANNOTATED_SUFFIX="_with_annotations"
export LIB_HOME="$KAR_HOME/src/"

# Set the location of the application
SRC_CODE="$KAR_HOME/src/apps/$EXPERIMENT"
# CHANGE: The main file of the app.
if [ "$EXPERIMENT" == "wiki" ]; then
	MAIN_CODE_REL="server"
else
	MAIN_CODE_REL="app.js"
fi
#For wiki it is
SRC_MAIN_CODE="$SRC_CODE/$MAIN_CODE_REL"
export SRC_NODE_MODULES="$SRC_CODE/node_modules"

# Do not complile anything in the node-modules when running compile.sh
export NO_NODE_MODULES=true

# Ignore javascript min files
export IGNORE_MIN_JS=true

# Suffixes of transpiled code
export SUFFIX="" #empty suffix for the original
if [ "$IS_PROVER" == true ]; then
	export SUFFIX="-prover"
fi
if [ "$IS_VERIFIER" == true ]; then
	export SUFFIX="-verifier"
fi

#--Set the destination folders for the transpiled code
DST_CODE="$SRC_CODE$SUFFIX"
if [ "$ADVICE_MODE" -ge 5 ]; then
	# If we are compiling without the function wrappers change the code destinations
	DST_CODE="${DST_CODE}-${ADVICE_MODE}"
fi


export DST_MAIN_CODE="$DST_CODE/$MAIN_CODE_REL"
export DST_NODE_MODULES="$DST_CODE/node_modules"

#----Set the precompiled express library
export EXPRESS_PATH="$DST_CODE/node_modules/express"

#----Environment for the db

basedir="$MYSQL_INSTALL_LOC"
bindir="$basedir/bin"
mysql="$bindir/mysql"
mysqld_safe="$bindir/mysqld_safe"
mysqladmin="$bindir/mysqladmin"
datadir="$basedir/data"

#The isolation level
isolation_level=SERIALIZABLE
if [ -v ISOLATION_LEVEL ]; then
	if [ "$ISOLATION_LEVEL" -eq "1" ]; then
		isolation_level=READ-COMMITTED
	elif [ "$ISOLATION_LEVEL" -eq "0" ]; then
		isolation_level=READ-UNCOMMITTED
	else
		if [ "$ISOLATION_LEVEL" -ne "3" ]; then
			echo "ERROR: Unsupported isolation level. We only support 3-serializability, 1-read committed, and 0-read uncommitted"
			exit 1
		fi
	fi
fi

#CHANGE: Default database name and user for our applications
if [ "$EXPERIMENT" == "wiki" ]; then
	database="wiki"
else
	database="test"
fi

user=mysql

#Parameters for generating the binary log
autocommit=OFF
binlog_format=ROW
mysqlbinlog="$bindir/mysqlbinlog"
start_time=none
stop_time=none
parser="$KAR_HOME/src/mysql_binlog/binlog_parser/parser.py"
binlog_txt="${ADVICE_DIR}/binlog.txt"
