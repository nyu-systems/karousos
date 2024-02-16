#!/bin/bash

USAGE="Usage: $0 [#total requests] [#ignore]"
if [ $# -ne 2 ]; then 
	echo "Incorrect number of arguments. $USAGE"
	exit
fi

for i in 1 10 20
do
	export KEEP_ALIVE_FOR_ORIG=20000
	export KEEP_ALIVE_FOR_SERVER=20000
	req_no=$(( $1 / $i ))
	export TOT_REQS=$req_no
	export IGNORE_REQS=$(( $2 / $i ))
	#Read-heavy workload
	../../create_workloads/create_workloads_probability.sh -a inventory -r $req_no -t $i -P 10 -U 50 -v true 

	workload="post-10_update-50_"$req_no"_$i"

	./run_workload.sh inventory $workload $2

	sleep 10s
	
	export KEEP_ALIVE_FOR_ORIG=40000
	export KEEP_ALIVE_FOR_SERVER=40000
	
	#Write-heavy workload
	../../create_workloads/create_workloads_probability.sh -a inventory -r $req_no -t $i -P 90 -U 50 -v true 

	workload="post-90_update-50_"$req_no"_$i"

	./run_workload.sh inventory $workload $2

	sleep 10s

	#Mixed workload
	../../create_workloads/create_workloads_probability.sh -a inventory -r $req_no -t $i -P 50 -U 50 -v true

	workload="post-50_update-50_"$req_no"_$i"

	./run_workload.sh inventory $workload $2

	sleep 10s
done
