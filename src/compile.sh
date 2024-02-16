#!/bin/bash

USAGE="Usage: $0 application [mode = 0]. Mode = 0 for prover and 1 for verifier" 
IS_PROVER=true
IS_VERIFIER=false

if [ $# -eq 1 ]; then 
	echo "No arguments passed. Default mode: IS_VERIFIER=false"
elif [ $# -gt 2 ]; then
	echo "Too many arguments passed. $USAGE"
	exit -1
elif [ $# -lt 1 ]; then
	echo "Too few arguments passed. $USAGE"
	exit -1
else 
	if [ "$2" == "1" ]; then
		IS_VERIFIER=true
		IS_PROVER=false
	elif [ "$2" != "0" ]; then
		echo "Argument passed not of the correct type. $USAGE"
		exit -1
	fi
fi

# Load the environment
export EXPERIMENT=$1
source env.sh

# Copies the annotated knex and express libraries
function copyTweakedLibraries() {
	#--Replace knex with precompiled
	TARGETS=$(find $DST_CODE -path "*/node_modules/knex" -print)
	for DST_KNEX in $TARGETS
	do
		if [[ -d  "$DST_KNEX" ]]
		then
			rm -rf "$DST_KNEX"
			cp -RT "$KAR_HOME/src/annotated_libs/knexTweaked$SUFFIX" "$DST_KNEX"
		fi
	done
	#--Replace express with precompiled
	TARGETS=$(find $DST_CODE -path "*/node_modules/express" -print)
	for DST_EXPRESS in $TARGETS
	do
		echo "Copying tweaked libraries, $DST_EXPRESS"
		if [[ -d  "$DST_EXPRESS" ]]
		then
			rm -r "$DST_EXPRESS"
			echo "Copying kar_home $KAR_HOME/src/annotated_libs/express$SUFFIX $DST_EXPRESS"
			cp -RT "$KAR_HOME/src/annotated_libs/express$SUFFIX" "$DST_EXPRESS"
		fi
	done
}

# If there exists an annotated version of the requested library use it instead of the 
# default one
if [[ -d "${SRC_CODE}_annotated" ]]
then
	SRC_CODE=${SRC_CODE}_annotated
	SRC_MAIN_CODE="$SRC_CODE/$MAIN_CODE_REL"
	echo $SRC_CODE
fi

# Copy the src code to the destination code
rsync -avr --exclude "$MAIN_CODE_REL" "$SRC_CODE/" "$DST_CODE"
# Copy the annotated libraries in node_modules
copyTweakedLibraries	
# Parse only the code of the main function. Because NO_NODE_MODULES=true we do not compile any 
# modules required that are in node_modules. 
node --max_old_space_size=8192 --optimize_for_size --stack_size=4096 ./compiler "$SRC_MAIN_CODE" "$DST_MAIN_CODE" "$IS_VERIFIER" --onlyRequired
