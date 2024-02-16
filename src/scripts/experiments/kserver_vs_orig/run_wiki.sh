#!/bin/bash

USAGE="Usage: $0 [#total requests] [#ignore]"
if [ $# -ne 2 ]; then
	echo "Incorrect number of arguments. $USAGE"
	exit
fi

for i in 1 10 20 30 60
do
	export KEEP_ALIVE_FOR_ORIG=85000
	export KEEP_ALIVE_FOR_SERVER=150000
	export IGNORE_REQS=$(( $2 / $i ))

	workload="mix$i"

	./run_workload.sh wiki $workload $2
done
