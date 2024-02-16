#!/bin/bash

application=$1
workload=$2

iterations=10
	
echo "Running $workload"
echo "-----------------"
echo ""

cd $KAR_HOME/src/

export KEEP_ALIVE_FOR=$KEEP_ALIVE_FOR_ORIG
echo "Running Original Server"
./runServer.sh --unmodified -i $iterations $application $workload

sleep 10s

echo "Running Karousos Server $workload"
export KEEP_ALIVE_FOR=$KEEP_ALIVE_FOR_SERVER
./runServer.sh --collect-orochi-js-advice $application $workload

sleep 10s

echo "Running Karousos-Verifier $workload"
./runVerifier.sh -i $iterations $application $workload

sleep 10s

echo "Running Orochi-Verifier $workload"
./runVerifier.sh --orochi-js -i $iterations $application $workload

echo "Reporting performance"
python3 ./scripts/experiments/kver_vs_orig_concurrent_reqs/report_performance.py "../measurements/$application-$workload" ./scripts/experiments/kver_vs_orig_concurrent_reqs/results/$application-$workload.csv ./scripts/experiments/kver_vs_orig_concurrent_reqs/results/advice-size/$application-${workload}.csv
