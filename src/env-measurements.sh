#------Set up the environment to collect measurements

# We collect the measurements for original/server/verifier in one folder 
# per experiment
PARENT_FOLDER="$KAR_HOME/measurements/$EXPERIMENT_NAME/" 

# Pick the folder depending on whether we are running the original, the
# server, or the verifier
MEASUREMENTS_FOLDER="$PARENT_FOLDER/original"
if $IS_PROVER; then
	if [ $ADVICE_MODE == "0" ]; then
		MEASUREMENTS_FOLDER="$PARENT_FOLDER/server"
	else
		MEASUREMENTS_FOLDER="$PARENT_FOLDER/server-${ADVICE_MODE}"
	fi
fi
if $IS_VERIFIER; then
	if "$OROCHI_JS"; then
		MEASUREMENTS_FOLDER="$PARENT_FOLDER/orochijs-verifier"
	else
		MEASUREMENTS_FOLDER="$PARENT_FOLDER/karousos-verifier"
	fi
fi

# If there are more than one iterations then delete the existing results 
# in the first iteration and save the results for each iteration
if [ $iterations -ne 1 ]; then
	if [ $ITERATION -eq 0 ]; then
		rm -r "$MEASUREMENTS_FOLDER"
	fi
	MEASUREMENTS_FOLDER="$MEASUREMENTS_FOLDER/$ITERATION/"
fi

# Create the folder where we will save the measurements
rm -r "$MEASUREMENTS_FOLDER"
mkdir -p "$MEASUREMENTS_FOLDER"

#Specify the individual files where we are saving measurements
export INITIALIZATION_MEASUREMENTS="$MEASUREMENTS_FOLDER/init.csv"
export REQUEST_MEASUREMENTS="$MEASUREMENTS_FOLDER/requests.csv"
export GROUP_INFO="$MEASUREMENTS_FOLDER/group_info.json"
export PROCESS_ADVICE_MEASUREMENTS="$MEASUREMENTS_FOLDER/process_advice.csv"
export ACTIVE_TIME_MEASUREMENTS="$MEASUREMENTS_FOLDER/active_time.csv"
export ADVICE_SIZE_MEASUREMENTS="$MEASUREMENTS_FOLDER/advice_size.csv"
