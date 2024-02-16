#!/bin/bash

application=$1
workload=$2
ignore_p=$3

iterations=10

echo "Running $workload"
echo "-----------------"
echo ""

cd $KAR_HOME/src/

export KEEP_ALIVE_FOR=$KEEP_ALIVE_FOR_ORIG
echo "Running Original Server"
./runServer.sh --unmodified -i $iterations $application $workload


sleep 10s
echo "Running Karousos Server" 
./runServer.sh -i $iterations $application $workload

python3 ./scripts/experiments/kserver_vs_orig/report_performance.py "../measurements/$application-$workload" $ignore_p ./scripts/experiments/kserver_vs_orig/results/$application-$workload.csv
